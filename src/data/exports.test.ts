import { beforeEach, describe, expect, it } from 'vitest';
import { PantryDB } from './db';
import { createExports } from './exports';
import { createInventory, ensureCatalog } from './inventory';
import { createRecipes } from './recipes';
import { createShopping } from './shopping';
import { errorMessage } from './errors';
import { InventoryError } from './inventory';

let db: PantryDB;
beforeEach(async () => {
  db = new PantryDB('x-' + Math.random());
  await ensureCatalog(db);
  await createRecipes(db).seedStarterRecipes();
});

const lines = (csv: string) =>
  csv
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n');

describe('exports', () => {
  it('inventory: one row per lot with names, units and dates; hostile notes are neutralised', async () => {
    const inv = createInventory(db);
    await inv.addLot({
      ingredientId: 'ing-milk',
      quantity: 1,
      unit: 'l',
      zone: 'fridge',
      dateLabel: 'use_by',
      date: '2031-02-03',
      note: '=HYPERLINK("http://evil")',
    });
    await inv.addLot({
      ingredientId: 'ing-flour',
      quantity: 1.5,
      unit: 'kg',
      zone: 'custom',
      customZoneName: 'Cellar, left',
      dateLabel: 'unknown',
    });
    const out = lines(await createExports(db).inventoryCsv());
    expect(out[0]).toBe(
      'Ingredient,Category,Quantity,Unit,Stored in,Date type,Date,Purchased,Opened,Cost,Currency,Note',
    );
    expect(out).toHaveLength(3);
    expect(out[1]).toContain('Flour,Baking,1.5,kg,"Cellar, left"');
    expect(out[2]).toContain('Milk,Dairy & Eggs,1,l,fridge,Use by,2031-02-03');
    expect(out[2]).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it('shopping: includes ticked, stocked, prices and the list currency', async () => {
    const shop = createShopping(db);
    const l = await shop.createList('Weekly', 'EUR');
    await shop.addItem(l.id, {
      name: 'Flour',
      ingredientId: 'ing-flour',
      quantity: 500,
      unit: 'g',
      category: 'Baking',
      unitPrice: 2,
    });
    const { name, csv } = await createExports(db).shoppingCsv(l.id);
    expect(name).toBe('Weekly');
    expect(lines(csv)[1]).toBe('Flour,500,g,Baking,no,no,2,1,EUR,');
  });

  it('history and recipes export what exists', async () => {
    const rec = createRecipes(db);
    const s = await rec.startCooking('garden-salad', 4);
    await rec.finishCooking(s.id, [], { rating: 4, notes: 'good, crisp' });
    const h = lines(await createExports(db).historyCsv());
    expect(h[1]).toMatch(/^\d{4}-\d{2}-\d{2},Garden Salad,4,4,"good, crisp",no,$/);
    const r = lines(await createExports(db).recipesCsv());
    expect(r.length).toBeGreaterThan(33);
    expect(r.find((x) => x.startsWith('Garden Salad,Starter cookbook'))).toBeTruthy();
  });
});

describe('errorMessage', () => {
  it('turns storage problems into plain advice', () => {
    expect(errorMessage(new InventoryError('Only 3 left', 'insufficient'))).toBe('Only 3 left');
    expect(errorMessage(Object.assign(new Error('x'), { name: 'QuotaExceededError' }))).toMatch(
      /out of storage space/,
    );
    expect(errorMessage({ name: 'DexieError', inner: { name: 'QuotaExceededError' } })).toMatch(
      /out of storage space/,
    );
    expect(errorMessage(Object.assign(new Error('x'), { name: 'SecurityError' }))).toMatch(
      /blocking local storage/,
    );
    expect(errorMessage(new Error('boom'))).toMatch(/Nothing was changed\. \(boom\)/);
    expect(errorMessage('weird')).toBe('Something went wrong. Nothing was changed.');
  });
});
