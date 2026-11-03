import { beforeEach, describe, expect, it } from 'vitest';
import { PantryDB } from './db';
import { createInventory, ensureCatalog, type LotInput } from './inventory';
import { createRecipes } from './recipes';
import { createPlanner } from './planner';
import { createShopping } from './shopping';
import { buildNeeds, estimateTotal, explainNeed, lineCost, priceBasis } from '@/domain/shopping';
import { cellEntries, slotsFor } from '@/domain/planning';

let db: PantryDB;
let inv: ReturnType<typeof createInventory>;
let rec: ReturnType<typeof createRecipes>;
let plan: ReturnType<typeof createPlanner>;
let shop: ReturnType<typeof createShopping>;

const lot = (o: Partial<LotInput> = {}): LotInput => ({
  ingredientId: 'ing-flour',
  quantity: 1000,
  unit: 'g',
  zone: 'pantry',
  dateLabel: 'unknown',
  ...o,
});

beforeEach(async () => {
  db = new PantryDB('p-' + Math.random());
  inv = createInventory(db);
  rec = createRecipes(db);
  plan = createPlanner(db);
  shop = createShopping(db);
  await ensureCatalog(db);
  await rec.seedStarterRecipes();
});

async function needs(entries: { recipeId: string; servings: number }[], listId?: string) {
  const ingredients = new Map((await db.ingredients.toArray()).map((i) => [i.id, i]));
  const inputs = [];
  for (const e of entries) {
    const full = (await rec.getFull(e.recipeId))!;
    inputs.push({
      recipeName: full.recipe.name,
      lines: full.ingredients,
      factor: e.servings / full.recipe.servings,
    });
  }
  const items = listId ? await db.shoppingItems.where('listId').equals(listId).toArray() : [];
  return buildNeeds(inputs, ingredients, await db.inventoryLots.toArray(), items);
}

describe('meal planner', () => {
  it('adds, orders, moves, duplicates, marks done and removes entries', async () => {
    const a = await plan.addEntry({
      date: '2030-05-06',
      slot: 'dinner',
      recipeId: 'garden-frittata',
      servings: 3,
    });
    const b = await plan.addEntry({
      date: '2030-05-06',
      slot: 'dinner',
      label: 'Leftovers',
      servings: 2,
    });
    const all = () => db.mealPlans.toArray();
    expect(cellEntries(await all(), '2030-05-06', 'dinner').map((e) => e.id)).toEqual([a.id, b.id]);

    await plan.updateEntry(a.id, { servings: 5 });
    await plan.updateEntry(a.id, { date: '2030-05-07', slot: 'lunch' });
    const moved = (await db.mealPlans.get(a.id))!;
    expect(moved).toMatchObject({ date: '2030-05-07', slot: 'lunch', servings: 5 });

    const copy = await plan.duplicateEntry(a.id, { date: '2030-05-08', slot: 'Brunch' });
    expect(copy.recipeId).toBe('garden-frittata');
    expect(slotsFor(await all())).toEqual(['breakfast', 'lunch', 'dinner', 'snack', 'Brunch']);

    await plan.setDone(a.id, true);
    expect((await db.mealPlans.get(a.id))!.done).toBe(true);
    await plan.removeEntry(b.id);
    expect(await db.mealPlans.count()).toBe(2);
  });

  it('validates input', async () => {
    await expect(
      plan.addEntry({ date: '2030-02-31', slot: 'dinner', label: 'x', servings: 1 }),
    ).rejects.toThrow('valid date');
    await expect(
      plan.addEntry({ date: '2030-05-06', slot: 'dinner', servings: 1 }),
    ).rejects.toThrow('Pick a recipe');
    await expect(
      plan.addEntry({
        date: '2030-05-06',
        slot: 'dinner',
        recipeId: 'garden-frittata',
        servings: 0,
      }),
    ).rejects.toThrow();
    await expect(
      plan.addEntry({ date: '2030-05-06', slot: 'dinner', recipeId: 'nope', servings: 2 }),
    ).rejects.toThrow('no longer exists');
  });

  it('deleting a recipe keeps planned meals as notes', async () => {
    const id = await rec.saveRecipe({
      name: 'Mine',
      summary: '',
      tags: [],
      prepMinutes: 1,
      cookMinutes: 1,
      difficulty: 'easy',
      servings: 2,
      ingredients: [{ ingredientId: 'ing-flour', quantity: 1, unit: 'g' }],
      steps: [{ text: 'Do it' }],
    });
    const e = await plan.addEntry({
      date: '2030-05-06',
      slot: 'dinner',
      recipeId: id,
      servings: 2,
    });
    await rec.deleteRecipe(id);
    const after = (await db.mealPlans.get(e.id))!;
    expect(after.recipeId).toBeUndefined();
    expect(after.label).toBe('Mine');
  });

  it('cooking from a plan entry marks it done', async () => {
    const e = await plan.addEntry({
      date: '2030-05-06',
      slot: 'dinner',
      recipeId: 'garden-frittata',
      servings: 3,
    });
    const s = await rec.startCooking('garden-frittata', 3);
    await rec.finishCooking(s.id, [], { planEntryId: e.id });
    expect((await db.mealPlans.get(e.id))!.done).toBe(true);
  });
});

describe('shopping needs', () => {
  it('consolidates overlapping recipes and subtracts stock once', async () => {
    // Pasta Aglio e Olio needs 200 g pasta (2 servings); Tomato pasta needs 320 g (4 servings)
    await inv.addLot(lot({ ingredientId: 'ing-pasta', quantity: 300 }));
    const rows = await needs([
      { recipeId: 'spaghetti-aglio-olio', servings: 2 },
      { recipeId: 'creamy-tomato-pasta', servings: 4 },
    ]);
    const pasta = rows.find((r) => r.ingredientId === 'ing-pasta')!;
    expect(pasta.needed).toBe(520);
    expect(pasta.inStock).toBe(300);
    expect(pasta.toBuy).toBe(220);
    expect(pasta.sources).toEqual(['Creamy Tomato Pasta', 'Spaghetti Aglio e Olio']);
    expect(explainNeed(pasta)).toBe('Need 520 g, have 300 g, buy 220 g');
  });

  it('does not subtract stock in an incomparable unit, and says so', async () => {
    await inv.addLot(lot({ ingredientId: 'ing-garlic', quantity: 1, unit: 'g' })); // garlic counted in pcs by recipes
    const rows = await needs([{ recipeId: 'spaghetti-aglio-olio', servings: 2 }]);
    const garlic = rows.find((r) => r.ingredientId === 'ing-garlic')!;
    expect(garlic.inStock).toBe(0);
    expect(garlic.stockNotComparable).toBe(true);
    expect(garlic.toBuy).toBe(4);
  });

  it('skips optional ingredients', async () => {
    const rows = await needs([{ recipeId: 'spaghetti-aglio-olio', servings: 2 }]);
    expect(rows.find((r) => r.ingredientId === 'ing-parsley')).toBeUndefined();
  });

  it('counts what is already on the list and merges instead of duplicating', async () => {
    const list = await shop.createList('Weekly', 'EUR');
    const first = await needs([{ recipeId: 'spaghetti-aglio-olio', servings: 2 }]);
    expect(await shop.applyNeeds(list.id, first)).toMatchObject({
      added: first.filter((r) => r.toBuy > 0).length,
      merged: 0,
    });
    const again = await needs([{ recipeId: 'spaghetti-aglio-olio', servings: 2 }], list.id);
    expect(again.every((r) => r.toBuy === 0)).toBe(true);
    expect(again.find((r) => r.ingredientId === 'ing-pasta')!.onList).toBe(200);
    // a bigger plan only asks for the difference, merged into the existing item
    const more = await needs([{ recipeId: 'spaghetti-aglio-olio', servings: 4 }], list.id);
    expect(more.find((r) => r.ingredientId === 'ing-pasta')!.toBuy).toBe(200);
    await shop.applyNeeds(list.id, more);
    const items = await db.shoppingItems.where('listId').equals(list.id).toArray();
    expect(items.filter((i) => i.ingredientId === 'ing-pasta')).toHaveLength(1);
    expect(items.find((i) => i.ingredientId === 'ing-pasta')!.quantity).toBe(400);
  });

  it('done meals can be left out by the caller; stocked items stop counting as on the list', async () => {
    const list = await shop.createList('L', 'EUR');
    const rows = await needs([{ recipeId: 'spaghetti-aglio-olio', servings: 2 }]);
    await shop.applyNeeds(list.id, rows);
    const pasta = (await db.shoppingItems.toArray()).find((i) => i.ingredientId === 'ing-pasta')!;
    await shop.setChecked(pasta.id, true);
    const after = await needs([{ recipeId: 'spaghetti-aglio-olio', servings: 2 }], list.id);
    expect(after.find((r) => r.ingredientId === 'ing-pasta')!.toBuy).toBe(200); // ticked ≠ in the pantry
  });
});

describe('shopping lists', () => {
  it('manages lists and items; ticking never changes the pantry', async () => {
    const l = await shop.createList('Market', 'MKD');
    await expect(shop.createList('market', 'MKD')).rejects.toThrow('already exists');
    const it = await shop.addItem(l.id, { name: 'Basil plant', category: 'Other' });
    const flour = await shop.addItem(l.id, {
      name: 'Flour',
      ingredientId: 'ing-flour',
      quantity: 1,
      unit: 'kg',
      category: 'Baking',
    });
    await expect(shop.addItem(l.id, { name: 'x', quantity: 2 })).rejects.toThrow(
      'both an amount and a unit',
    );
    await shop.setChecked(flour.id, true);
    expect(await db.inventoryLots.count()).toBe(0);
    await shop.updateItem(flour.id, {
      name: 'Flour',
      ingredientId: 'ing-flour',
      quantity: 2,
      unit: 'kg',
      category: 'Baking',
      unitPrice: 1.5,
    });
    const upd = (await db.shoppingItems.get(flour.id))!;
    expect(upd).toMatchObject({ quantity: 2, unitPrice: 1.5, checked: true });
    await shop.updateList(l.id, { budget: 20, name: 'Market day' });
    expect(await db.shoppingLists.get(l.id)).toMatchObject({ budget: 20, name: 'Market day' });
    await shop.updateList(l.id, { budget: null });
    expect((await db.shoppingLists.get(l.id))!.budget).toBeUndefined();
    await shop.removeItems([it.id]);
    await shop.deleteList(l.id);
    expect(await db.shoppingItems.count()).toBe(0);
  });

  it('estimates cost per kg/L/piece without mixing up units', () => {
    expect(priceBasis('g').label).toBe('kg');
    expect(priceBasis('ml').label).toBe('L');
    expect(priceBasis('can').label).toBe('can');
    expect(lineCost({ quantity: 500, unit: 'g', unitPrice: 2 })).toBe(1);
    expect(lineCost({ quantity: 1.5, unit: 'l', unitPrice: 2 })).toBe(3);
    expect(lineCost({ quantity: 3, unit: 'pcs', unitPrice: 0.5 })).toBe(1.5);
    expect(lineCost({ quantity: 3, unit: 'pcs' })).toBeNull();
    const t = estimateTotal([
      { quantity: 500, unit: 'g', unitPrice: 2 },
      { quantity: 3, unit: 'pcs', unitPrice: 0.5 },
      { quantity: 1, unit: 'pcs' },
    ] as never);
    expect(t).toEqual({ total: 2.5, priced: 2, unpriced: 1 });
  });

  it('stocks purchases atomically, once, with the confirmed amount and place', async () => {
    const l = await shop.createList('L', 'EUR');
    const a = await shop.addItem(l.id, {
      name: 'Flour',
      ingredientId: 'ing-flour',
      quantity: 1,
      unit: 'kg',
      category: 'Baking',
      unitPrice: 2,
    });
    const b = await shop.addItem(l.id, {
      name: 'Milk',
      ingredientId: 'ing-milk',
      quantity: 1,
      unit: 'l',
      category: 'Dairy & Eggs',
    });
    await shop.setChecked(a.id, true);
    await shop.setChecked(b.id, true);
    await shop.stockPurchased([
      {
        itemId: a.id,
        ingredientId: 'ing-flour',
        quantity: 900,
        unit: 'g',
        zone: 'pantry',
        dateLabel: 'best_before',
        date: '2031-01-01',
      },
      {
        itemId: b.id,
        ingredientId: 'ing-milk',
        quantity: 1,
        unit: 'l',
        zone: 'fridge',
        dateLabel: 'use_by',
        date: '2031-01-01',
      },
    ]);
    const lots = await db.inventoryLots.toArray();
    expect(lots).toHaveLength(2);
    expect(lots.find((x) => x.ingredientId === 'ing-flour')).toMatchObject({
      quantity: 900,
      unit: 'g',
      zone: 'pantry',
      cost: 1.8,
      currency: 'EUR',
    });
    expect((await db.inventoryEvents.toArray()).every((e) => e.type === 'purchase')).toBe(true);
    expect((await db.shoppingItems.get(a.id))!.stockedAt).toBeTruthy();
    // never twice
    await expect(
      shop.stockPurchased([
        {
          itemId: a.id,
          ingredientId: 'ing-flour',
          quantity: 900,
          unit: 'g',
          zone: 'pantry',
          dateLabel: 'unknown',
        },
      ]),
    ).rejects.toThrow('already added');
    expect(await db.inventoryLots.count()).toBe(2);
  });

  it('rolls everything back when one purchase row is invalid', async () => {
    const l = await shop.createList('L', 'EUR');
    const a = await shop.addItem(l.id, {
      name: 'Flour',
      ingredientId: 'ing-flour',
      quantity: 1,
      unit: 'kg',
      category: 'Baking',
    });
    const b = await shop.addItem(l.id, {
      name: 'Milk',
      ingredientId: 'ing-milk',
      quantity: 1,
      unit: 'l',
      category: 'Dairy & Eggs',
    });
    await expect(
      shop.stockPurchased([
        {
          itemId: a.id,
          ingredientId: 'ing-flour',
          quantity: 900,
          unit: 'g',
          zone: 'pantry',
          dateLabel: 'unknown',
        },
        {
          itemId: b.id,
          ingredientId: 'ing-milk',
          quantity: -1,
          unit: 'l',
          zone: 'fridge',
          dateLabel: 'unknown',
        },
      ]),
    ).rejects.toThrow();
    expect(await db.inventoryLots.count()).toBe(0);
    expect(await db.inventoryEvents.count()).toBe(0);
    expect((await db.shoppingItems.get(a.id))!.stockedAt).toBeUndefined();
  });
});
