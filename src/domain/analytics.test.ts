import { describe, expect, it } from 'vitest';
import type {
  CookingSession,
  Ingredient,
  InventoryEvent,
  InventoryLot,
  MealPlanEntry,
  ShoppingItem,
  ShoppingList,
} from '@/data/types';
import {
  categoryComposition,
  cooks,
  cooksPerWeek,
  dateBuckets,
  filterLots,
  plannedVariety,
  shoppingEstimates,
  storageDistribution,
  topIngredients,
  usedBeforeDate,
} from './analytics';

const ing = (id: string, name: string, category: string): Ingredient => ({
  id,
  name,
  category,
  aliases: [],
  defaultUnit: 'g',
  allergens: [],
  isCustom: false,
  createdAt: 0,
  updatedAt: 0,
});
const INGS = new Map([
  ['a', ing('a', 'Flour', 'Baking')],
  ['b', ing('b', 'Milk', 'Dairy & Eggs')],
  ['c', ing('c', 'Eggs', 'Dairy & Eggs')],
]);
const lot = (id: string, ingredientId: string, o: Partial<InventoryLot> = {}): InventoryLot => ({
  id,
  ingredientId,
  quantity: 1,
  unit: 'g',
  zone: 'pantry',
  dateLabel: 'unknown',
  createdAt: 1,
  updatedAt: 1,
  ...o,
});
const NOW = Date.parse('2030-06-12T10:00:00');
const DAY = 86_400_000;
const session = (
  id: string,
  daysAgo: number,
  ids: string[],
  o: Partial<CookingSession> = {},
): CookingSession => ({
  id,
  recipeId: 'r',
  startedAt: NOW - daysAgo * DAY,
  finishedAt: NOW - daysAgo * DAY,
  servings: 2,
  status: 'completed',
  deductions: ids.map((i) => ({ ingredientId: i, quantity: 1, unit: 'g' })),
  ...o,
});

describe('pantry charts', () => {
  const lots = [
    lot('1', 'a'),
    lot('2', 'b', { zone: 'fridge' }),
    lot('3', 'b', { zone: 'fridge' }),
    lot('4', 'c', { zone: 'freezer' }),
  ];
  it('counts distinct ingredients per category, not lots or quantities', () => {
    expect(categoryComposition(lots, INGS)).toEqual([
      { label: 'Dairy & Eggs', value: 2 },
      { label: 'Baking', value: 1 },
    ]);
  });
  it('counts lots per storage place and applies filters', () => {
    expect(storageDistribution(lots)).toEqual([
      { label: 'Pantry', value: 1 },
      { label: 'Fridge', value: 2 },
      { label: 'Freezer', value: 1 },
    ]);
    expect(filterLots(lots, INGS, { category: 'Dairy & Eggs', zone: 'fridge' })).toHaveLength(2);
    expect(filterLots(lots, INGS, { category: '', zone: '' })).toHaveLength(4);
  });
  it('buckets dates; past dates and undated lots are their own groups and totals reconcile', () => {
    const l = [
      lot('1', 'a', { dateLabel: 'use_by', date: '2030-06-10' }),
      lot('2', 'a', { dateLabel: 'best_before', date: '2030-06-12' }),
      lot('3', 'a', { dateLabel: 'best_before', date: '2030-06-15' }),
      lot('4', 'a', { dateLabel: 'best_before', date: '2030-06-19' }),
      lot('5', 'a', { dateLabel: 'best_before', date: '2030-07-10' }),
      lot('6', 'a', { dateLabel: 'best_before', date: '2031-01-01' }),
      lot('7', 'a'),
    ];
    const b = dateBuckets(l, '2030-06-12');
    expect(b.map((x) => x.value)).toEqual([1, 2, 1, 0, 1, 1, 1]);
    expect(b.reduce((s, x) => s + x.value, 0)).toBe(l.length);
  });
});

describe('activity charts', () => {
  const sessions = [
    session('1', 1, ['a', 'b']),
    session('2', 2, ['b']),
    session('3', 40, ['c']),
    session('4', 3, ['a'], { undoneAt: NOW }),
    session('5', 3, ['a'], { status: 'cancelled' }),
  ];
  it('ignores undone and cancelled cooks and respects the range', () => {
    expect(cooks(sessions, { rangeDays: null }, NOW).map((s) => s.id)).toEqual(['1', '2', '3']);
    expect(cooks(sessions, { rangeDays: 30 }, NOW).map((s) => s.id)).toEqual(['1', '2']);
    expect(cooks(sessions, { rangeDays: 7 }, NOW)).toHaveLength(2);
  });
  it('counts cooks per week and the total matches the records in the window', () => {
    const weeks = cooksPerWeek(sessions, new Date(NOW), 'monday', 8);
    expect(weeks).toHaveLength(8);
    expect(weeks.reduce((s, w) => s + w.value, 0)).toBe(3);
    expect(weeks.at(-1)!.value).toBe(2);
  });
  it('ranks ingredients by number of cooks and filters by category', () => {
    const counted = cooks(sessions, { rangeDays: null }, NOW);
    expect(topIngredients(counted, INGS, '')).toEqual([
      { label: 'Milk', value: 2 },
      { label: 'Eggs', value: 1 },
      { label: 'Flour', value: 1 },
    ]);
    expect(topIngredients(counted, INGS, 'Baking')).toEqual([{ label: 'Flour', value: 1 }]);
  });
  it('plans variety per week: entries with a recipe vs distinct recipes', () => {
    const e = (date: string, recipeId?: string): MealPlanEntry => ({
      id: date + recipeId,
      date,
      slot: 'dinner',
      recipeId,
      label: recipeId ? undefined : 'Out',
      servings: 1,
      position: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    const v = plannedVariety(
      [
        e('2030-06-10', 'x'),
        e('2030-06-11', 'x'),
        e('2030-06-12', 'y'),
        e('2030-06-12'),
        e('2030-06-03', 'z'),
      ],
      new Date(NOW),
      'monday',
      2,
    );
    expect(v.map((x) => [x.planned, x.distinct])).toEqual([
      [1, 1],
      [3, 2],
    ]);
  });
});

describe('money and waste', () => {
  it('keeps each list in its own currency and reports unpriced items', () => {
    const lists: ShoppingList[] = [
      { id: 'l1', name: 'A', currency: 'EUR', createdAt: 0, updatedAt: 0, budget: 5 },
      { id: 'l2', name: 'B', currency: 'MKD', createdAt: 0, updatedAt: 0 },
      { id: 'l3', name: 'C', currency: 'EUR', createdAt: 0, updatedAt: 0 },
    ];
    const it = (listId: string, o: Partial<ShoppingItem>): ShoppingItem => ({
      id: Math.random() + '',
      listId,
      name: 'x',
      category: 'Other',
      checked: false,
      createdAt: 0,
      updatedAt: 0,
      ...o,
    });
    const rows = shoppingEstimates(lists, [
      it('l1', { quantity: 500, unit: 'g', unitPrice: 2 }),
      it('l1', { quantity: 1, unit: 'pcs' }),
      it('l2', { quantity: 2, unit: 'pcs', unitPrice: 100 }),
      it('l1', { quantity: 1, unit: 'pcs', unitPrice: 9, stockedAt: 1 }),
    ]);
    expect(rows).toEqual([
      { list: 'A', currency: 'EUR', total: 1, priced: 1, unpriced: 1, budget: 5 },
      { list: 'B', currency: 'MKD', total: 200, priced: 1, unpriced: 0, budget: undefined },
    ]);
  });
  it('counts only recorded uses that happened inside the lead window before the date', () => {
    const ev = (
      daysAgo: number,
      date: string | undefined,
      type: InventoryEvent['type'] = 'use',
    ): InventoryEvent => ({
      id: Math.random() + '',
      lotId: 'l',
      ingredientId: 'b',
      type,
      delta: -1,
      unit: 'g',
      at: NOW - daysAgo * DAY,
      snapshot: date ? lot('l', 'b', { dateLabel: 'use_by', date }) : lot('l', 'b'),
    });
    const events = [
      ev(0, '2030-06-14'), // used 2 days before its date → counts
      ev(0, '2030-06-30'), // date far away → no
      ev(0, '2030-06-01'), // used after its date → no
      ev(0, undefined), // no date → no
      ev(0, '2030-06-14', 'discard'), // discard is not use → no
      ev(60, '2030-04-20'), // outside range
    ];
    expect(usedBeforeDate(events, INGS, 7, { rangeDays: 30 }, NOW)).toEqual({
      count: 1,
      names: ['Milk'],
    });
  });
});
