import { describe, expect, it } from 'vitest';
import type { Ingredient, InventoryLot, Recipe, RecipeIngredient } from '@/data/types';
import { groupLots, recipeAvailability } from './recipes';
import { usableLots } from './lots';
import { matchRecipe, tierLabel, type MatchContext } from './matching';

const ing = (id: string, name: string, allergens: string[] = []): Ingredient => ({
  id,
  name,
  aliases: [],
  category: 'Other',
  defaultUnit: 'g',
  allergens,
  isCustom: false,
  createdAt: 0,
  updatedAt: 0,
});
const INGS = new Map([
  ['a', ing('a', 'Flour', ['gluten'])],
  ['b', ing('b', 'Milk', ['dairy'])],
  ['c', ing('c', 'Eggs', ['eggs'])],
  ['d', ing('d', 'Salt')],
]);
const line = (id: string, q: number, unit = 'g', optional = false): RecipeIngredient => ({
  id: 'l' + id,
  recipeId: 'r',
  ingredientId: id,
  quantity: q,
  unit,
  position: 0,
  optional,
});
const lot = (
  id: string,
  ingredientId: string,
  quantity: number,
  o: Partial<InventoryLot> = {},
): InventoryLot => ({
  id,
  ingredientId,
  quantity,
  unit: 'g',
  zone: 'pantry',
  dateLabel: 'unknown',
  createdAt: 1,
  updatedAt: 1,
  ...o,
});
const recipe = (o: Partial<Recipe> = {}): Recipe => ({
  id: 'r',
  name: 'R',
  summary: '',
  tags: ['vegetarian'],
  prepMinutes: 10,
  cookMinutes: 10,
  difficulty: 'easy',
  servings: 2,
  favorite: false,
  isStarter: false,
  createdAt: 0,
  updatedAt: 0,
  ...o,
});
const CTX: MatchContext = {
  today: '2030-06-10',
  leadDays: 7,
  diets: [] as string[],
  allergens: [] as string[],
  now: Date.parse('2030-06-10T12:00:00Z'),
};

function run(lines: RecipeIngredient[], lots: InventoryLot[], r = recipe(), ctx = CTX) {
  const usable = usableLots(lots, ctx.today);
  const avail = recipeAvailability(lines, 1, groupLots(usable), INGS);
  return matchRecipe(r, lines, avail, groupLots(usable), INGS, groupLots(lots), ctx);
}

describe('matching', () => {
  it('ready when everything is covered, with every point explained', () => {
    const m = run([line('a', 100), line('b', 100)], [lot('1', 'a', 500), lot('2', 'b', 500)]);
    expect(m.tier).toBe('ready');
    expect(m.missing).toEqual([]);
    expect(m.parts.map((p) => p.key)).toEqual([
      'coverage',
      'useSoon',
      'time',
      'variety',
      'favorite',
    ]);
    expect(m.parts.every((p) => p.note.length > 0 && p.points <= p.max)).toBe(true);
    expect(m.parts[0].points).toBe(55);
    expect(m.score).toBe(Math.round(m.parts.reduce((s, p) => s + p.points, 0)));
  });

  it('nearly ready when one or two are missing, else missing', () => {
    const lots = [lot('1', 'a', 500), lot('2', 'b', 500), lot('3', 'c', 500)];
    const one = run([line('a', 1), line('b', 1), line('c', 1), line('d', 1)], lots);
    expect(one.tier).toBe('nearly');
    expect(one.missing).toEqual([{ ingredientId: 'd', name: 'Salt', text: 'not in your pantry' }]);
    expect(tierLabel(one.tier, one.missing.length)).toBe('Nearly ready · 1 to get');
    const many = run([line('a', 1), line('b', 1), line('c', 1), line('d', 1)], [lot('1', 'a', 5)]);
    expect(many.tier).toBe('missing');
    expect(tierLabel(many.tier, many.missing.length)).toBe('3 ingredients missing');
  });

  it('gives partial credit for a short amount and says so', () => {
    const m = run([line('a', 200)], [lot('1', 'a', 100)]);
    expect(m.tier).toBe('missing');
    expect(m.missing[0].text).toBe('not enough');
    expect(m.parts[0].points).toBe(27.5); // 0.5 of 55
  });

  it('boosts recipes that use ingredients with a date coming up, never past-date stock', () => {
    const soon = lot('1', 'a', 500, { dateLabel: 'best_before', date: '2030-06-12' });
    const base = run([line('a', 1)], [lot('1', 'a', 500)]);
    const boosted = run(
      [line('a', 1), line('b', 1)],
      [soon, lot('2', 'b', 500, { dateLabel: 'use_by', date: '2030-06-11' })],
    );
    expect(base.parts[1].points).toBe(0);
    expect(boosted.useSoon).toEqual(['Flour', 'Milk']);
    expect(boosted.parts[1].points).toBe(20);
    // use-by already passed: not counted as stock, not boosted, flagged
    const past = run(
      [line('b', 1)],
      [lot('2', 'b', 500, { dateLabel: 'use_by', date: '2030-06-01' })],
    );
    expect(past.tier).toBe('missing');
    expect(past.useSoon).toEqual([]);
    expect(past.skippedPastDate).toBe(true);
    // a past best-before still counts (quality date)
    const bb = run(
      [line('b', 1)],
      [lot('2', 'b', 500, { dateLabel: 'best_before', date: '2030-06-01' })],
    );
    expect(bb.tier).toBe('ready');
    expect(bb.skippedPastDate).toBe(false);
  });

  it('does not boost when the pantry barely covers the recipe', () => {
    const m = run(
      [line('a', 1), line('b', 1), line('c', 1)],
      [lot('1', 'a', 5, { dateLabel: 'best_before', date: '2030-06-12' })],
    );
    expect(m.parts[1].points).toBe(0);
  });

  it('favourites, speed and variety move the score by their stated amounts', () => {
    const stock = [lot('1', 'a', 500)];
    const plain = run([line('a', 1)], stock);
    const fav = run([line('a', 1)], stock, recipe({ favorite: true }));
    expect(fav.score - plain.score).toBe(5);
    const slow = run([line('a', 1)], stock, recipe({ prepMinutes: 60, cookMinutes: 60 }));
    expect(plain.score - slow.score).toBe(7); // 8 points for 20 min, 1 for 2 h
    const recent = run([line('a', 1)], stock, recipe(), {
      ...CTX,
      lastCooked: CTX.now - 1 * 86_400_000,
    });
    expect(plain.score - recent.score).toBe(10);
    const mid = run([line('a', 1)], stock, recipe(), {
      ...CTX,
      lastCooked: CTX.now - 5 * 86_400_000,
    });
    expect(plain.score - mid.score).toBe(5);
  });

  it('reports allergens and diets from the data entered, informationally', () => {
    const m = run([line('a', 1), line('b', 1)], [], recipe({ tags: ['Vegetarian'] }), {
      ...CTX,
      allergens: ['Gluten', 'sesame'],
      diets: ['vegetarian', 'vegan'],
    });
    expect(m.allergens).toEqual(['gluten']);
    expect(m.diets).toEqual(['vegetarian']);
  });

  it('optional lines never lower coverage', () => {
    const m = run([line('a', 1), line('d', 1, 'g', true)], [lot('1', 'a', 5)]);
    expect(m.tier).toBe('ready');
  });

  it('is deterministic', () => {
    const go = () => run([line('a', 1), line('b', 1)], [lot('1', 'a', 5)]);
    expect(go()).toEqual(go());
  });
});
