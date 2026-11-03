import { z } from 'zod';
import type { PantryDB } from './db';
import { db as defaultDb } from './db';
import { createInventory, InventoryError } from './inventory';
import { STARTER_RECIPES, STARTER_VERSION } from './starterRecipes';
import type {
  AppliedDeduction,
  Collection,
  CookingSession,
  CookingTimer,
  Recipe,
  RecipeIngredient,
  RecipeStep,
} from './types';
import { isKnownUnit } from '@/domain/units';
import { makeTimer, pauseTimer, resumeTimer } from '@/domain/timers';
import { newId } from '@/lib/ids';

export const recipeInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the recipe a name')
    .max(80, 'Keep the name under 80 characters'),
  summary: z.string().trim().max(300, 'Keep the summary under 300 characters').default(''),
  cuisine: z.string().trim().max(40).optional(),
  category: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  prepMinutes: z.number().min(0).max(1440),
  cookMinutes: z.number().min(0).max(1440),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  servings: z.number().int('Whole servings only').min(1).max(100),
  imageId: z.string().optional(),
  art: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().min(1, 'Choose an ingredient'),
        quantity: z
          .number({ error: 'Enter an amount' })
          .positive('Amount must be above 0')
          .max(1_000_000),
        unit: z.string().refine(isKnownUnit, 'Choose a unit'),
        optional: z.boolean().optional(),
      }),
    )
    .min(1, 'Add at least one ingredient')
    .max(60),
  steps: z
    .array(
      z.object({
        text: z.string().trim().min(1, 'A step cannot be empty').max(1000),
        timerSeconds: z.number().int().min(1).max(86_400).optional(),
      }),
    )
    .min(1, 'Add at least one step')
    .max(60),
});
export type RecipeInput = z.input<typeof recipeInputSchema>;

export interface FullRecipe {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

export function createRecipes(database: PantryDB = defaultDb) {
  const inventory = createInventory(database);

  /** Adds or refreshes the bundled cookbook. Favourites on starter recipes are preserved. */
  async function seedStarterRecipes(): Promise<number> {
    const row = await database.preferences.get('starterVersion');
    if (row?.value === STARTER_VERSION) return 0;
    let added = 0;
    await database.transaction(
      'rw',
      [database.recipes, database.recipeIngredients, database.recipeSteps, database.preferences],
      async () => {
        const now = Date.now();
        for (const s of STARTER_RECIPES) {
          const existing = await database.recipes.get(s.recipe.id);
          if (existing && !existing.isStarter) continue; // user took over this id: never overwrite
          if (!existing) added++;
          await database.recipes.put({
            ...s.recipe,
            favorite: existing?.favorite ?? false,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          });
          await database.recipeIngredients.where('recipeId').equals(s.recipe.id).delete();
          await database.recipeSteps.where('recipeId').equals(s.recipe.id).delete();
          await database.recipeIngredients.bulkAdd(s.ingredients);
          await database.recipeSteps.bulkAdd(s.steps);
        }
        await database.preferences.put({ key: 'starterVersion', value: STARTER_VERSION });
      },
    );
    return added;
  }

  async function getFull(id: string): Promise<FullRecipe | undefined> {
    const recipe = await database.recipes.get(id);
    if (!recipe) return undefined;
    const [ingredients, steps] = await Promise.all([
      database.recipeIngredients.where('recipeId').equals(id).sortBy('position'),
      database.recipeSteps.where('recipeId').equals(id).sortBy('position'),
    ]);
    return { recipe, ingredients, steps };
  }

  function build(
    id: string,
    v: z.output<typeof recipeInputSchema>,
  ): { ingredients: RecipeIngredient[]; steps: RecipeStep[] } {
    return {
      ingredients: v.ingredients.map((l, i) => ({
        ...clean(l),
        id: `${id}-i${i}-${newId().slice(0, 8)}`,
        recipeId: id,
        position: i,
      })) as RecipeIngredient[],
      steps: v.steps.map((s, i) => ({
        ...clean(s),
        id: `${id}-s${i}-${newId().slice(0, 8)}`,
        recipeId: id,
        position: i,
      })) as RecipeStep[],
    };
  }

  /** Creates (no id) or updates (id) a personal recipe. Starter recipes are read-only: duplicate them. */
  async function saveRecipe(input: RecipeInput, id?: string): Promise<string> {
    const parsed = recipeInputSchema.safeParse(input);
    if (!parsed.success) throw new InventoryError(parsed.error.issues[0].message, 'invalid');
    const v = parsed.data;
    const rid = id ?? newId();
    await database.transaction(
      'rw',
      [database.recipes, database.recipeIngredients, database.recipeSteps, database.mediaAssets],
      async () => {
        const prev = id ? await database.recipes.get(id) : undefined;
        if (id && !prev) throw new InventoryError('That recipe no longer exists', 'not_found');
        if (prev?.isStarter)
          throw new InventoryError(
            'Starter recipes cannot be edited. Duplicate it first.',
            'invalid',
          );
        const now = Date.now();
        const rest: Record<string, unknown> = { ...v };
        delete rest.ingredients;
        delete rest.steps;
        const recipe: Recipe = clean({
          ...rest,
          id: rid,
          favorite: prev?.favorite ?? false,
          isStarter: false,
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
        }) as Recipe;
        await database.recipes.put(recipe);
        await database.recipeIngredients.where('recipeId').equals(rid).delete();
        await database.recipeSteps.where('recipeId').equals(rid).delete();
        const b = build(rid, v);
        await database.recipeIngredients.bulkAdd(b.ingredients);
        await database.recipeSteps.bulkAdd(b.steps);
        if (prev?.imageId && prev.imageId !== recipe.imageId)
          await database.mediaAssets.delete(prev.imageId);
      },
    );
    return rid;
  }

  async function duplicateRecipe(id: string): Promise<string> {
    const full = await getFull(id);
    if (!full) throw new InventoryError('That recipe no longer exists', 'not_found');
    const { recipe, ingredients, steps } = full;
    return saveRecipe({
      name: `${recipe.name} (copy)`.slice(0, 80),
      summary: recipe.summary,
      cuisine: recipe.cuisine,
      category: recipe.category,
      tags: recipe.tags,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      difficulty: recipe.difficulty,
      servings: recipe.servings,
      art: recipe.art,
      notes: recipe.notes,
      ingredients: ingredients.map((l) => ({
        ingredientId: l.ingredientId,
        quantity: l.quantity,
        unit: l.unit,
        optional: l.optional,
      })),
      steps: steps.map((s) => ({ text: s.text, timerSeconds: s.timerSeconds })),
    });
  }

  async function deleteRecipe(id: string): Promise<void> {
    await database.transaction(
      'rw',
      [
        database.recipes,
        database.recipeIngredients,
        database.recipeSteps,
        database.collections,
        database.cookingSessions,
        database.mediaAssets,
        database.mealPlans,
      ],
      async () => {
        const r = await database.recipes.get(id);
        if (!r) return;
        if (r.isStarter)
          throw new InventoryError(
            'Starter recipes are part of the app and cannot be deleted',
            'invalid',
          );
        await database.recipeIngredients.where('recipeId').equals(id).delete();
        await database.recipeSteps.where('recipeId').equals(id).delete();
        if (r.imageId) await database.mediaAssets.delete(r.imageId);
        for (const c of await database.collections.toArray()) {
          if (c.recipeIds.includes(id))
            await database.collections.update(c.id, {
              recipeIds: c.recipeIds.filter((x) => x !== id),
              updatedAt: Date.now(),
            });
        }
        // An unfinished cooking session for a deleted recipe is cancelled; completed history stays.
        await database.cookingSessions
          .where('recipeId')
          .equals(id)
          .filter((s) => s.status === 'active')
          .modify({ status: 'cancelled', finishedAt: Date.now(), timers: [] });
        // Planned meals keep their place as a plain note instead of silently disappearing.
        await database.mealPlans
          .where('recipeId')
          .equals(id)
          .modify((e) => {
            e.label = r.name;
            delete e.recipeId;
          });
        await database.recipes.delete(id);
      },
    );
  }

  async function setFavorite(id: string, favorite: boolean) {
    const n = await database.recipes.update(id, { favorite });
    if (!n) throw new InventoryError('That recipe no longer exists', 'not_found');
  }

  // ----- collections -----

  async function createCollection(name: string): Promise<Collection> {
    const n = name.trim();
    if (!n || n.length > 50)
      throw new InventoryError('Enter a name (up to 50 characters)', 'invalid');
    const dupe = await database.collections.where('name').equalsIgnoreCase(n).first();
    if (dupe) throw new InventoryError(`"${dupe.name}" already exists`, 'duplicate');
    const now = Date.now();
    const c: Collection = { id: newId(), name: n, recipeIds: [], createdAt: now, updatedAt: now };
    await database.collections.add(c);
    return c;
  }

  async function renameCollection(id: string, name: string) {
    const n = name.trim();
    if (!n || n.length > 50)
      throw new InventoryError('Enter a name (up to 50 characters)', 'invalid');
    const dupe = await database.collections.where('name').equalsIgnoreCase(n).first();
    if (dupe && dupe.id !== id)
      throw new InventoryError(`"${dupe.name}" already exists`, 'duplicate');
    await database.collections.update(id, { name: n, updatedAt: Date.now() });
  }

  async function deleteCollection(id: string) {
    await database.collections.delete(id);
  }

  async function setInCollection(collectionId: string, recipeId: string, on: boolean) {
    await database.transaction('rw', database.collections, database.recipes, async () => {
      const c = await database.collections.get(collectionId);
      if (!c) throw new InventoryError('That collection no longer exists', 'not_found');
      if (!(await database.recipes.get(recipeId)))
        throw new InventoryError('That recipe no longer exists', 'not_found');
      const has = c.recipeIds.includes(recipeId);
      if (on === has) return;
      await database.collections.update(collectionId, {
        recipeIds: on ? [...c.recipeIds, recipeId] : c.recipeIds.filter((x) => x !== recipeId),
        updatedAt: Date.now(),
      });
    });
  }

  // ----- cooking sessions -----

  /** Resumes the unfinished session for this recipe, or starts a new one. */
  async function startCooking(recipeId: string, servings: number): Promise<CookingSession> {
    return database.transaction('rw', database.cookingSessions, database.recipes, async () => {
      const recipe = await database.recipes.get(recipeId);
      if (!recipe) throw new InventoryError('That recipe no longer exists', 'not_found');
      const active = await database.cookingSessions
        .where('recipeId')
        .equals(recipeId)
        .filter((s) => s.status === 'active')
        .first();
      if (active) return active;
      const s: CookingSession = {
        id: newId(),
        recipeId,
        recipeName: recipe.name,
        startedAt: Date.now(),
        servings,
        status: 'active',
        stepIndex: 0,
        checkedIngredients: [],
        checkedSteps: [],
        timers: [],
      };
      await database.cookingSessions.add(s);
      return s;
    });
  }

  async function patchSession(
    id: string,
    patch: Partial<
      Pick<CookingSession, 'stepIndex' | 'checkedIngredients' | 'checkedSteps' | 'servings'>
    >,
  ) {
    await database.transaction('rw', database.cookingSessions, async () => {
      const s = await database.cookingSessions.get(id);
      if (!s || s.status !== 'active') return;
      await database.cookingSessions.update(id, patch);
    });
  }

  async function startTimer(
    sessionId: string,
    label: string,
    seconds: number,
  ): Promise<CookingTimer> {
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 86_400)
      throw new InventoryError('Timers run from 1 second to 24 hours', 'invalid');
    return database.transaction('rw', database.cookingSessions, async () => {
      const s = await database.cookingSessions.get(sessionId);
      if (!s || s.status !== 'active')
        throw new InventoryError('This cooking session is over', 'not_found');
      const t = makeTimer(newId(), label.slice(0, 60), Math.round(seconds), Date.now());
      await database.cookingSessions.update(sessionId, { timers: [...(s.timers ?? []), t] });
      return t;
    });
  }

  async function removeTimer(sessionId: string, timerId: string) {
    await database.transaction('rw', database.cookingSessions, async () => {
      const s = await database.cookingSessions.get(sessionId);
      if (!s) return;
      await database.cookingSessions.update(sessionId, {
        timers: (s.timers ?? []).filter((t) => t.id !== timerId),
      });
    });
  }

  async function setTimerPaused(sessionId: string, timerId: string, paused: boolean) {
    await database.transaction('rw', database.cookingSessions, async () => {
      const s = await database.cookingSessions.get(sessionId);
      if (!s || s.status !== 'active') return;
      const now = Date.now();
      await database.cookingSessions.update(sessionId, {
        timers: (s.timers ?? []).map((t) =>
          t.id !== timerId ? t : paused ? pauseTimer(t, now) : resumeTimer(t, now),
        ),
      });
    });
  }

  /** Stops the session and changes nothing in the pantry. */
  async function cancelCooking(id: string) {
    await database.transaction('rw', database.cookingSessions, async () => {
      const s = await database.cookingSessions.get(id);
      if (!s || s.status !== 'active') return;
      await database.cookingSessions.update(id, {
        status: 'cancelled',
        finishedAt: Date.now(),
        timers: [],
      });
    });
  }

  /**
   * Finishes cooking and applies the confirmed deductions in ONE transaction. If any row
   * cannot be applied, nothing is: stock and the session stay as they were. A finished session
   * cannot be applied again, and each row carries an idempotency key as a second guard.
   */
  async function finishCooking(
    id: string,
    deductions: AppliedDeduction[],
    extra: { rating?: number; notes?: string; planEntryId?: string } = {},
  ): Promise<AppliedDeduction[]> {
    if (extra.rating != null && !(extra.rating >= 1 && extra.rating <= 5))
      throw new InventoryError('Ratings go from 1 to 5', 'invalid');
    return database.transaction(
      'rw',
      [
        database.cookingSessions,
        database.inventoryLots,
        database.inventoryEvents,
        database.ingredients,
        database.recipes,
        database.mealPlans,
      ],
      async () => {
        const s = await database.cookingSessions.get(id);
        if (!s) throw new InventoryError('That cooking session no longer exists', 'not_found');
        if (s.status !== 'active')
          throw new InventoryError('This cooking session was already finished', 'duplicate');
        const applied: AppliedDeduction[] = [];
        for (const [i, d] of deductions.entries()) {
          if (!(d.quantity > 0)) continue;
          await inventory.consume(d.ingredientId, d.quantity, d.unit, {
            idempotencyKey: `cook:${id}:${i}`,
            note: `Cooked ${s.recipeName ?? 'a recipe'}`,
          });
          applied.push({ ingredientId: d.ingredientId, quantity: d.quantity, unit: d.unit });
        }
        if (extra.planEntryId)
          await database.mealPlans.update(extra.planEntryId, { done: true, updatedAt: Date.now() });
        await database.cookingSessions.update(id, {
          status: 'completed',
          finishedAt: Date.now(),
          deductions: applied,
          timers: [],
          ...clean({ rating: extra.rating, notes: extra.notes?.trim().slice(0, 500) }),
        });
        return applied;
      },
    );
  }

  return {
    seedStarterRecipes,
    getFull,
    saveRecipe,
    duplicateRecipe,
    deleteRecipe,
    setFavorite,
    createCollection,
    renameCollection,
    deleteCollection,
    setInCollection,
    startCooking,
    patchSession,
    startTimer,
    removeTimer,
    setTimerPaused,
    cancelCooking,
    finishCooking,
  };
}

export const recipes = createRecipes();
