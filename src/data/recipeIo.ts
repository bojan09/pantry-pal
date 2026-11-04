import { z } from '@/lib/z';
import type { PantryDB } from './db';
import { db as defaultDb } from './db';
import { createInventory, InventoryError } from './inventory';
import { createRecipes, type RecipeInput } from './recipes';
import type { Ingredient } from './types';
import { isKnownUnit } from '@/domain/units';
import type { FullRecipe } from './recipes';

export const RECIPE_FORMAT = 'pantrypal.recipe';

const fileSchema = z.object({
  format: z.literal(RECIPE_FORMAT, { error: 'This is not a PantryPal recipe file' }),
  version: z.literal(1, { error: 'This recipe file is from a newer version of PantryPal' }),
  recipe: z.object({
    name: z.string().trim().min(1).max(80),
    summary: z.string().trim().max(300).default(''),
    cuisine: z.string().trim().max(40).optional(),
    category: z.string().trim().max(40).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
    prepMinutes: z.number().min(0).max(1440),
    cookMinutes: z.number().min(0).max(1440),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    servings: z.number().int().min(1).max(100),
    notes: z.string().trim().max(2000).optional(),
    ingredients: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(60),
          quantity: z.number().positive().max(1_000_000),
          unit: z.string().refine(isKnownUnit, 'Unknown unit'),
          optional: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(60),
    steps: z
      .array(
        z.object({
          text: z.string().trim().min(1).max(1000),
          timerSeconds: z.number().int().min(1).max(86_400).optional(),
        }),
      )
      .min(1)
      .max(60),
  }),
});
export type RecipeFile = z.infer<typeof fileSchema>;

/** Plain, human-readable JSON. Ingredients are named, not ID-linked, so it works on any device. */
export function exportRecipe(full: FullRecipe, ingredients: Map<string, Ingredient>): RecipeFile {
  const { recipe, ingredients: lines, steps } = full;
  return {
    format: RECIPE_FORMAT,
    version: 1,
    recipe: {
      name: recipe.name,
      summary: recipe.summary,
      cuisine: recipe.cuisine,
      category: recipe.category,
      tags: recipe.tags,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      difficulty: recipe.difficulty,
      servings: recipe.servings,
      notes: recipe.notes,
      ingredients: lines.map((l) => ({
        name: ingredients.get(l.ingredientId)?.name ?? 'Unknown',
        quantity: l.quantity,
        unit: l.unit,
        optional: l.optional,
      })),
      steps: steps.map((s) => ({ text: s.text, timerSeconds: s.timerSeconds })),
    },
  };
}

export function parseRecipeFile(text: string): RecipeFile {
  if (text.length > 500_000)
    throw new InventoryError('That file is too large to be a recipe', 'invalid');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InventoryError('That is not valid JSON', 'invalid');
  }
  const r = fileSchema.safeParse(json);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new InventoryError(
      `${i.message}${i.path.length ? ` (${i.path.join(' › ')})` : ''}`,
      'invalid',
    );
  }
  return r.data;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Which ingredients already exist, and which would be created as custom ones. */
export function planImport(file: RecipeFile, ingredients: Ingredient[]) {
  const find = (name: string) =>
    ingredients.find(
      (i) => norm(i.name) === norm(name) || i.aliases.some((a) => norm(a) === norm(name)),
    );
  const unknown = [
    ...new Set(file.recipe.ingredients.filter((l) => !find(l.name)).map((l) => l.name.trim())),
  ];
  return { find, unknown };
}

export function createRecipeIo(database: PantryDB = defaultDb) {
  const inv = createInventory(database);
  const rec = createRecipes(database);

  /** Imports as a new personal recipe. Unknown ingredients become custom ones. */
  async function importRecipe(file: RecipeFile): Promise<string> {
    const all = await database.ingredients.toArray();
    const { find } = planImport(file, all);
    const lines: RecipeInput['ingredients'] = [];
    for (const l of file.recipe.ingredients) {
      let ing = find(l.name);
      if (!ing) {
        ing = await inv.createIngredient({ name: l.name, category: 'Other', defaultUnit: l.unit });
        all.push(ing);
      }
      lines.push({
        ingredientId: ing.id,
        quantity: l.quantity,
        unit: l.unit,
        optional: l.optional,
      });
    }
    const { ingredients: _i, steps, ...rest } = file.recipe;
    void _i;
    return rec.saveRecipe({ ...rest, ingredients: lines, steps });
  }

  return { importRecipe };
}

export const recipeIo = createRecipeIo();
