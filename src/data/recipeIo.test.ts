import { beforeEach, describe, expect, it } from 'vitest';
import { PantryDB } from './db';
import { ensureCatalog } from './inventory';
import { createRecipes } from './recipes';
import {
  createRecipeIo,
  exportRecipe,
  parseRecipeFile,
  planImport,
  RECIPE_FORMAT,
} from './recipeIo';

let db: PantryDB;
beforeEach(async () => {
  db = new PantryDB('io-' + Math.random());
  await ensureCatalog(db);
  await createRecipes(db).seedStarterRecipes();
});

describe('recipe import/export', () => {
  it('round-trips a recipe through JSON text', async () => {
    const rec = createRecipes(db);
    const full = (await rec.getFull('chickpea-curry'))!;
    const ings = new Map((await db.ingredients.toArray()).map((i) => [i.id, i]));
    const text = JSON.stringify(exportRecipe(full, ings));
    const file = parseRecipeFile(text);
    const id = await createRecipeIo(db).importRecipe(file);
    const copy = (await rec.getFull(id))!;
    expect(copy.recipe.isStarter).toBe(false);
    expect(copy.recipe.name).toBe('Chickpea Curry');
    expect(copy.ingredients.map((l) => [l.ingredientId, l.quantity, l.unit])).toEqual(
      full.ingredients.map((l) => [l.ingredientId, l.quantity, l.unit]),
    );
    expect(copy.steps.map((s) => [s.text, s.timerSeconds])).toEqual(
      full.steps.map((s) => [s.text, s.timerSeconds]),
    );
  });

  it('creates unknown ingredients as custom ones and lists them first', async () => {
    const file = parseRecipeFile(
      JSON.stringify({
        format: RECIPE_FORMAT,
        version: 1,
        recipe: {
          name: 'Test',
          prepMinutes: 1,
          cookMinutes: 1,
          difficulty: 'easy',
          servings: 2,
          ingredients: [
            { name: 'Dragon fruit', quantity: 2, unit: 'pcs' },
            { name: 'tomato', quantity: 1, unit: 'pcs' },
          ],
          steps: [{ text: 'Eat it' }],
        },
      }),
    );
    expect(planImport(file, await db.ingredients.toArray()).unknown).toEqual(['Dragon fruit']);
    const id = await createRecipeIo(db).importRecipe(file);
    const lines = await db.recipeIngredients.where('recipeId').equals(id).toArray();
    expect(lines).toHaveLength(2);
    expect((await db.ingredients.where('name').equals('Dragon fruit').first())!.isCustom).toBe(
      true,
    );
    expect(lines.some((l) => l.ingredientId === 'ing-tomatoes')).toBe(true); // alias matched
  });

  it('rejects malformed, foreign and hostile files with a clear message', () => {
    expect(() => parseRecipeFile('nope')).toThrow('not valid JSON');
    expect(() => parseRecipeFile('{}')).toThrow('not a PantryPal recipe');
    expect(() =>
      parseRecipeFile(JSON.stringify({ format: RECIPE_FORMAT, version: 2, recipe: {} })),
    ).toThrow('newer version');
    expect(() =>
      parseRecipeFile(JSON.stringify({ format: RECIPE_FORMAT, version: 1, recipe: { name: '' } })),
    ).toThrow();
    expect(() => parseRecipeFile('x'.repeat(600_000))).toThrow('too large');
    const badUnit = {
      format: RECIPE_FORMAT,
      version: 1,
      recipe: {
        name: 'x',
        prepMinutes: 1,
        cookMinutes: 1,
        difficulty: 'easy',
        servings: 1,
        ingredients: [{ name: 'a', quantity: 1, unit: 'bucket' }],
        steps: [{ text: 'y' }],
      },
    };
    expect(() => parseRecipeFile(JSON.stringify(badUnit))).toThrow('Unknown unit');
  });
});
