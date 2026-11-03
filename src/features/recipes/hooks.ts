import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Collection, CookingSession, Ingredient, Recipe } from '@/data/types';
import { groupLots, recipeAvailability, type RecipeAvailability } from '@/domain/recipes';

/** Current time, ticking while `active`. Timers display from stored end timestamps. */
export function useNow(active = true, everyMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), everyMs);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, everyMs]);
  return now;
}

export interface RecipeLibrary {
  recipes: Recipe[];
  collections: Collection[];
  ingredients: Map<string, Ingredient>;
  /** per recipe: ingredient names + aliases for searching */
  terms: Map<string, string[]>;
  availability: Map<string, RecipeAvailability>;
  lastCooked: Map<string, number>;
  cookedCount: Map<string, number>;
}

/** Live view of every recipe with its pantry coverage. `undefined` until the first read. */
export function useRecipeLibrary(): RecipeLibrary | undefined {
  const raw = useLiveQuery(async () => {
    const [recipes, lines, collections, ingredients, lots, sessions] = await Promise.all([
      db.recipes.toArray(),
      db.recipeIngredients.toArray(),
      db.collections.orderBy('name').toArray(),
      db.ingredients.toArray(),
      db.inventoryLots.toArray(),
      db.cookingSessions.filter((s) => s.status === 'completed').toArray(),
    ]);
    return { recipes, lines, collections, ingredients, lots, sessions };
  }, []);
  return useMemo(() => {
    if (!raw) return undefined;
    const ingredients = new Map(raw.ingredients.map((i) => [i.id, i]));
    const lotsBy = groupLots(raw.lots);
    const byRecipe = new Map<string, typeof raw.lines>();
    for (const l of raw.lines) {
      const a = byRecipe.get(l.recipeId);
      if (a) a.push(l);
      else byRecipe.set(l.recipeId, [l]);
    }
    const terms = new Map<string, string[]>();
    const availability = new Map<string, RecipeAvailability>();
    for (const r of raw.recipes) {
      const lines = (byRecipe.get(r.id) ?? []).sort((a, b) => a.position - b.position);
      terms.set(
        r.id,
        lines.flatMap((l) => {
          const i = ingredients.get(l.ingredientId);
          return i ? [i.name, ...i.aliases] : [];
        }),
      );
      availability.set(r.id, recipeAvailability(lines, 1, lotsBy, ingredients));
    }
    const lastCooked = new Map<string, number>();
    const cookedCount = new Map<string, number>();
    for (const s of raw.sessions) {
      const at = s.finishedAt ?? s.startedAt;
      lastCooked.set(s.recipeId, Math.max(lastCooked.get(s.recipeId) ?? 0, at));
      cookedCount.set(s.recipeId, (cookedCount.get(s.recipeId) ?? 0) + 1);
    }
    return {
      recipes: raw.recipes,
      collections: raw.collections,
      ingredients,
      terms,
      availability,
      lastCooked,
      cookedCount,
    };
  }, [raw]);
}

export interface RecipeDetail {
  recipe: Recipe | undefined;
  lines: import('@/data/types').RecipeIngredient[];
  steps: import('@/data/types').RecipeStep[];
  ingredients: Map<string, Ingredient>;
  lots: import('@/data/types').InventoryLot[];
  collections: Collection[];
  sessions: CookingSession[];
}

/** Live recipe + lines + steps + stock. `loading` is true before the first read finishes. */
export function useRecipeDetail(id: string | undefined): { loading: boolean; data?: RecipeDetail } {
  const raw = useLiveQuery(async () => {
    if (!id) return { missing: true as const };
    const recipe = await db.recipes.get(id);
    const [lines, steps, ingredients, lots, collections, sessions] = await Promise.all([
      db.recipeIngredients.where('recipeId').equals(id).sortBy('position'),
      db.recipeSteps.where('recipeId').equals(id).sortBy('position'),
      db.ingredients.toArray(),
      db.inventoryLots.toArray(),
      db.collections.orderBy('name').toArray(),
      db.cookingSessions.where('recipeId').equals(id).toArray(),
    ]);
    return {
      missing: false as const,
      recipe,
      lines,
      steps,
      ingredients: new Map(ingredients.map((i) => [i.id, i])),
      lots,
      collections,
      sessions,
    };
  }, [id]);
  if (!raw) return { loading: true };
  if (raw.missing) return { loading: false };
  return { loading: false, data: raw };
}
