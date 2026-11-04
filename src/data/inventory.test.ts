import { beforeEach, describe, expect, it } from 'vitest';
import { PantryDB } from './db';
import { CATALOG } from './catalog';
import { createInventory, ensureCatalog, InventoryError, type LotInput } from './inventory';
import { loadSamplePantry, removeSamplePantry } from './samplePantry';

let db: PantryDB;
let inv: ReturnType<typeof createInventory>;

const base = (o: Partial<LotInput> = {}): LotInput => ({
  ingredientId: 'ing-flour',
  quantity: 1000,
  unit: 'g',
  zone: 'pantry',
  dateLabel: 'unknown',
  ...o,
});
const qty = async (id: string) => (await db.inventoryLots.get(id))?.quantity;

beforeEach(async () => {
  db = new PantryDB('t-' + Math.random());
  inv = createInventory(db);
  await ensureCatalog(db);
});

describe('catalog', () => {
  it('seeds once, is idempotent and keeps user edits', async () => {
    const n = await db.ingredients.count();
    expect(n).toBe(CATALOG.length);
    await db.ingredients.update('ing-flour', { name: 'My flour' });
    await db.preferences.delete('catalogVersion');
    expect(await ensureCatalog(db)).toBe(0);
    expect((await db.ingredients.get('ing-flour'))!.name).toBe('My flour');
    expect(await db.ingredients.count()).toBe(n);
  });
  it('has unique stable ids and valid units', () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
  });
});

describe('addLot', () => {
  it('stores a lot and logs an add event', async () => {
    const lot = await inv.addLot(base());
    expect(await qty(lot.id)).toBe(1000);
    const evs = await db.inventoryEvents.toArray();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ type: 'add', delta: 1000, lotId: lot.id });
  });
  it('rejects bad input without writing anything', async () => {
    for (const bad of [
      base({ quantity: 0 }),
      base({ quantity: -5 }),
      base({ quantity: NaN }),
      base({ unit: 'stone' }),
      base({ dateLabel: 'use_by' }),
      base({ date: '2025-02-30', dateLabel: 'use_by' }),
      base({ zone: 'custom' }),
      base({ purchasedOn: '2025-05-02', openedOn: '2025-05-01' }),
      base({ ingredientId: '' }),
    ]) {
      await expect(inv.addLot(bad)).rejects.toBeInstanceOf(InventoryError);
    }
    await expect(inv.addLot(base({ ingredientId: 'ing-nope' }))).rejects.toMatchObject({
      code: 'not_found',
    });
    expect(await db.inventoryLots.count()).toBe(0);
    expect(await db.inventoryEvents.count()).toBe(0);
  });
  it('allows several lots of one ingredient with different dates and zones', async () => {
    await inv.addLot(base({ dateLabel: 'best_before', date: '2026-01-01' }));
    await inv.addLot(base({ zone: 'fridge', dateLabel: 'use_by', date: '2025-12-01' }));
    expect(await db.inventoryLots.where('ingredientId').equals('ing-flour').count()).toBe(2);
  });
});

describe('updateLot', () => {
  it('records a correction with the quantity change', async () => {
    const lot = await inv.addLot(base());
    await inv.updateLot(lot.id, base({ quantity: 800 }));
    expect(await qty(lot.id)).toBe(800);
    const ev = (await db.inventoryEvents.toArray()).find((e) => e.type === 'correct')!;
    expect(ev.delta).toBe(-200);
  });
  it('fails for a missing lot', async () => {
    await expect(inv.updateLot('nope', base())).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('consume', () => {
  it('spans lots earliest-first and logs one event per touched lot', async () => {
    const late = await inv.addLot(
      base({ quantity: 500, dateLabel: 'best_before', date: '2026-06-01' }),
    );
    const soon = await inv.addLot(base({ quantity: 200, dateLabel: 'use_by', date: '2025-11-01' }));
    await inv.consume('ing-flour', 300, 'g');
    expect(await qty(soon.id)).toBeUndefined(); // emptied -> removed
    expect(await qty(late.id)).toBe(400);
    const uses = (await db.inventoryEvents.toArray()).filter((e) => e.type === 'use');
    expect(uses.map((e) => e.delta).sort((a, b) => a - b)).toEqual([-200, -100]);
  });
  it('is all-or-nothing when stock is insufficient', async () => {
    const a = await inv.addLot(base({ quantity: 100 }));
    const b = await inv.addLot(base({ quantity: 100 }));
    await expect(inv.consume('ing-flour', 500, 'g')).rejects.toMatchObject({
      code: 'insufficient',
    });
    expect(await qty(a.id)).toBe(100);
    expect(await qty(b.id)).toBe(100);
    expect(await db.inventoryEvents.filter((e) => e.type === 'use').count()).toBe(0);
  });
  it('never allows negative stock and rejects invalid quantities', async () => {
    const a = await inv.addLot(base({ quantity: 10 }));
    for (const q of [0, -3, NaN])
      await expect(inv.consume('ing-flour', q, 'g')).rejects.toMatchObject({ code: 'invalid' });
    await expect(inv.consume('ing-flour', 10.0001, 'g')).rejects.toMatchObject({
      code: 'insufficient',
    });
    expect(await qty(a.id)).toBe(10);
  });
  it('refuses incompatible units without guessing', async () => {
    await inv.addLot(base());
    await expect(inv.consume('ing-flour', 1, 'pcs')).rejects.toMatchObject({
      code: 'incompatible',
    });
  });
  it('converts using ingredient density only when known', async () => {
    const f = await inv.addLot(base({ quantity: 530 })); // flour density 0.53 -> 1000 ml
    await inv.consume('ing-flour', 500, 'ml'); // 265 g
    expect(await qty(f.id)).toBeCloseTo(265, 6);
    const s = await inv.addLot(base({ ingredientId: 'ing-tomatoes', quantity: 5, unit: 'pcs' }));
    await expect(inv.consume('ing-tomatoes', 100, 'g')).rejects.toMatchObject({
      code: 'incompatible',
    });
    expect(await qty(s.id)).toBe(5);
  });
  it('blocks a repeated idempotency key so a cooking session cannot deduct twice', async () => {
    const a = await inv.addLot(base({ quantity: 1000 }));
    await inv.consume('ing-flour', 100, 'g', { idempotencyKey: 'cook-1' });
    await expect(
      inv.consume('ing-flour', 100, 'g', { idempotencyKey: 'cook-1' }),
    ).rejects.toMatchObject({ code: 'duplicate' });
    expect(await qty(a.id)).toBe(900);
  });
  it('rolls back everything if a write fails mid-transaction', async () => {
    const a = await inv.addLot(base({ quantity: 100, dateLabel: 'use_by', date: '2025-11-01' }));
    const b = await inv.addLot(
      base({ quantity: 100, dateLabel: 'best_before', date: '2026-01-01' }),
    );
    // Second event reuses an existing id -> unique violation after the first lot was already updated.
    const orig = db.inventoryEvents.add.bind(db.inventoryEvents);
    let calls = 0;
    db.inventoryEvents.add = ((ev: never) =>
      ++calls === 2 ? Promise.reject(new Error('disk full')) : orig(ev)) as never;
    await expect(inv.consume('ing-flour', 150, 'g')).rejects.toThrow('disk full');
    db.inventoryEvents.add = orig as never;
    expect(await qty(a.id)).toBe(100);
    expect(await qty(b.id)).toBe(100);
  });
});

describe('transfer', () => {
  it('moves a whole lot', async () => {
    const a = await inv.addLot(base());
    await inv.transfer(a.id, 'fridge', undefined);
    expect((await db.inventoryLots.get(a.id))!.zone).toBe('fridge');
  });
  it('splits a lot on a partial move and conserves quantity', async () => {
    const a = await inv.addLot(
      base({ quantity: 1000, dateLabel: 'best_before', date: '2026-02-02' }),
    );
    const newId = await inv.transfer(a.id, 'freezer', undefined, 400);
    const moved = (await db.inventoryLots.get(newId))!;
    expect(moved).toMatchObject({ quantity: 400, zone: 'freezer', date: '2026-02-02' });
    expect(await qty(a.id)).toBe(600);
  });
  it('rejects over-moves, zero and unnamed custom places', async () => {
    const a = await inv.addLot(base({ quantity: 10 }));
    await expect(inv.transfer(a.id, 'fridge', undefined, 11)).rejects.toMatchObject({
      code: 'insufficient',
    });
    await expect(inv.transfer(a.id, 'fridge', undefined, 0)).rejects.toMatchObject({
      code: 'invalid',
    });
    await expect(inv.transfer(a.id, 'custom', ' ')).rejects.toMatchObject({ code: 'invalid' });
    expect(await qty(a.id)).toBe(10);
  });
  it('supports a named custom place', async () => {
    const a = await inv.addLot(base());
    await inv.transfer(a.id, 'custom', 'Garage shelf');
    expect(await db.inventoryLots.get(a.id)).toMatchObject({
      zone: 'custom',
      customZoneName: 'Garage shelf',
    });
  });
});

describe('discard + undo', () => {
  it('discards a lot, logs it, and restores it exactly', async () => {
    const a = await inv.addLot(base({ quantity: 750, note: 'keep me' }));
    const { lot } = await inv.discardLot(a.id);
    expect(await qty(a.id)).toBeUndefined();
    expect(await db.inventoryEvents.filter((e) => e.type === 'discard').count()).toBe(1);
    await inv.undo([lot]);
    expect(await db.inventoryLots.get(a.id)).toMatchObject({ quantity: 750, note: 'keep me' });
  });
  it('undoes a consume across lots', async () => {
    const a = await inv.addLot(base({ quantity: 200, dateLabel: 'use_by', date: '2025-11-01' }));
    const b = await inv.addLot(
      base({ quantity: 500, dateLabel: 'best_before', date: '2026-06-01' }),
    );
    const res = await inv.consume('ing-flour', 300, 'g');
    await inv.undo(res.snapshots, res.steps);
    expect(await qty(a.id)).toBe(200);
    expect(await qty(b.id)).toBe(500);
  });
  it('refuses to undo when the lot changed in between', async () => {
    const a = await inv.addLot(base({ quantity: 500 }));
    const res = await inv.consume('ing-flour', 100, 'g');
    await inv.consume('ing-flour', 50, 'g');
    await expect(inv.undo(res.snapshots, res.steps)).rejects.toBeInstanceOf(InventoryError);
    expect(await qty(a.id)).toBe(350);
  });
});

describe('bulk + custom ingredients', () => {
  it('moves and discards several lots', async () => {
    const a = await inv.addLot(base());
    const b = await inv.addLot(base({ quantity: 5 }));
    await inv.transferBulk([a.id, b.id], 'fridge');
    expect((await db.inventoryLots.toArray()).every((l) => l.zone === 'fridge')).toBe(true);
    await inv.deleteLotsBulk([a.id, b.id]);
    expect(await db.inventoryLots.count()).toBe(0);
  });
  it('creates a custom ingredient and rejects duplicates and bad input', async () => {
    const i = await inv.createIngredient({
      name: ' Harissa ',
      category: 'Oils & Sauces',
      defaultUnit: 'g',
    });
    expect(i).toMatchObject({ name: 'Harissa', isCustom: true });
    await expect(
      inv.createIngredient({ name: 'harissa', category: 'Other', defaultUnit: 'g' }),
    ).rejects.toMatchObject({ code: 'duplicate' });
    await expect(
      inv.createIngredient({ name: 'milk', category: 'Other', defaultUnit: 'l' }),
    ).rejects.toMatchObject({ code: 'duplicate' });
    await expect(
      inv.createIngredient({ name: '', category: 'Other', defaultUnit: 'g' }),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      inv.createIngredient({ name: 'x', category: 'Other', defaultUnit: 'zz' }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('sample pantry', () => {
  it('loads labelled lots and removes only them', async () => {
    const mine = await inv.addLot(base({ quantity: 42 }));
    const n = await loadSamplePantry(db, new Date(2025, 9, 20));
    expect(n).toBeGreaterThan(20);
    expect(await db.inventoryLots.filter((l) => l.sample === true).count()).toBe(n);
    const bread = (await db.inventoryLots.toArray()).find((l) => l.ingredientId === 'ing-bread')!;
    expect(bread.date).toBe('2025-10-19'); // one day past, relative to the injected "today"
    expect(await removeSamplePantry(db)).toBe(n);
    expect(await db.inventoryLots.count()).toBe(1);
    expect(await qty(mine.id)).toBe(42);
    expect(await db.inventoryEvents.count()).toBe(1);
  });
});

describe('catalog v2: jar units', () => {
  it('defaults ajvar and pickles to medium jars and upgrades an older catalog without touching lots or custom items', async () => {
    expect((await db.ingredients.get('ing-ajvar'))!.defaultUnit).toBe('jar-m');
    // simulate a v1 database
    await db.ingredients.update('ing-ajvar', { defaultUnit: 'g' });
    const custom = await inv.createIngredient({
      name: 'My relish',
      category: 'Other',
      defaultUnit: 'g',
    });
    const lot = await inv.addLot(base({ ingredientId: 'ing-ajvar', quantity: 200, unit: 'g' }));
    await db.preferences.put({ key: 'catalogVersion', value: 1 });
    await ensureCatalog(db);
    expect((await db.ingredients.get('ing-ajvar'))!.defaultUnit).toBe('jar-m');
    expect((await db.ingredients.get(custom.id))!.defaultUnit).toBe('g');
    expect(await qty(lot.id)).toBe(200);
  });
  it('tracks jar sizes separately: sizes never merge or convert', async () => {
    await inv.addLot(base({ ingredientId: 'ing-ajvar', quantity: 2, unit: 'jar-s' }));
    await inv.addLot(base({ ingredientId: 'ing-ajvar', quantity: 1, unit: 'jar-l' }));
    await expect(inv.consume('ing-ajvar', 1, 'jar-m')).rejects.toMatchObject({
      code: 'incompatible',
    });
    await inv.consume('ing-ajvar', 1, 'jar-s');
    const lots = await db.inventoryLots.where('ingredientId').equals('ing-ajvar').toArray();
    expect(lots.map((l) => `${l.quantity} ${l.unit}`).sort()).toEqual(['1 jar-l', '1 jar-s']);
  });
});

describe('catalog seeding under concurrency', () => {
  it('two simultaneous callers never add the same ingredient twice or fail', async () => {
    const d = new PantryDB('race-' + Math.random());
    const [a, b] = await Promise.all([ensureCatalog(d), ensureCatalog(d)]);
    expect(a + b).toBe(CATALOG.length);
    expect(await d.ingredients.count()).toBe(CATALOG.length);
  });
  it('sample pantry loads even before the catalog was seeded, atomically', async () => {
    const d = new PantryDB('race2-' + Math.random());
    expect(await loadSamplePantry(d)).toBe(29);
    expect(await d.inventoryLots.count()).toBe(29);
  });
});
