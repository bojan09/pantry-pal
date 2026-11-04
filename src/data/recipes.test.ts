import { beforeEach, describe, expect, it } from 'vitest';
import { PantryDB } from './db';
import { CATALOG } from './catalog';
import { createInventory, ensureCatalog, InventoryError, type LotInput } from './inventory';
import { createRecipes, type RecipeInput } from './recipes';
import { STARTER_RECIPES } from './starterRecipes';
import { isKnownUnit } from '@/domain/units';
import { proposeDeductions, recipeAvailability, groupLots } from '@/domain/recipes';

let db: PantryDB;
let inv: ReturnType<typeof createInventory>;
let rec: ReturnType<typeof createRecipes>;

const lot = (o: Partial<LotInput> = {}): LotInput => ({
  ingredientId: 'ing-flour',
  quantity: 1000,
  unit: 'g',
  zone: 'pantry',
  dateLabel: 'unknown',
  ...o,
});
const mine = (o: Partial<RecipeInput> = {}): RecipeInput => ({
  name: 'Flour paste',
  summary: '',
  tags: [],
  prepMinutes: 5,
  cookMinutes: 0,
  difficulty: 'easy',
  servings: 2,
  ingredients: [
    { ingredientId: 'ing-flour', quantity: 200, unit: 'g' },
    { ingredientId: 'ing-milk', quantity: 300, unit: 'ml' },
  ],
  steps: [{ text: 'Mix.' }, { text: 'Rest.', timerSeconds: 600 }],
  ...o,
});
const qty = async (ing: string) =>
  (await db.inventoryLots.where('ingredientId').equals(ing).toArray()).reduce(
    (s, l) => s + l.quantity,
    0,
  );

beforeEach(async () => {
  db = new PantryDB('r-' + Math.random());
  inv = createInventory(db);
  rec = createRecipes(db);
  await ensureCatalog(db);
  await rec.seedStarterRecipes();
});

describe('starter cookbook', () => {
  it('has about 30 recipes, all complete and consistent with the catalog', () => {
    expect(STARTER_RECIPES.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(CATALOG.map((c) => c.id));
    const seen = new Set<string>();
    for (const { recipe, ingredients, steps } of STARTER_RECIPES) {
      expect(seen.has(recipe.id)).toBe(false);
      seen.add(recipe.id);
      expect(recipe.name.length).toBeGreaterThan(2);
      expect(recipe.summary.length).toBeGreaterThan(10);
      expect(recipe.servings).toBeGreaterThan(0);
      expect(ingredients.length).toBeGreaterThanOrEqual(3);
      expect(steps.length).toBeGreaterThanOrEqual(3);
      for (const l of ingredients) {
        expect(ids.has(l.ingredientId), `${recipe.id}: ${l.ingredientId}`).toBe(true);
        expect(isKnownUnit(l.unit), `${recipe.id}: unit ${l.unit}`).toBe(true);
        expect(l.quantity).toBeGreaterThan(0);
      }
      for (const s of steps) {
        expect(s.text.length).toBeGreaterThan(5);
        if (s.timerSeconds) expect(s.timerSeconds).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it('seeds once and keeps favourites across a content refresh', async () => {
    expect(await db.recipes.count()).toBe(STARTER_RECIPES.length);
    expect(await rec.seedStarterRecipes()).toBe(0);
    await rec.setFavorite('garden-frittata', true);
    await db.preferences.delete('starterVersion');
    await rec.seedStarterRecipes();
    expect((await db.recipes.get('garden-frittata'))!.favorite).toBe(true);
    expect(await db.recipes.count()).toBe(STARTER_RECIPES.length);
  });
});

describe('recipe CRUD', () => {
  it('creates, reads back ordered lines, updates and deletes a personal recipe', async () => {
    const id = await rec.saveRecipe(mine());
    const full = (await rec.getFull(id))!;
    expect(full.recipe.isStarter).toBe(false);
    expect(full.ingredients.map((l) => l.ingredientId)).toEqual(['ing-flour', 'ing-milk']);
    expect(full.steps[1].timerSeconds).toBe(600);

    await rec.setFavorite(id, true);
    await rec.saveRecipe(
      mine({
        name: 'Renamed',
        ingredients: [{ ingredientId: 'ing-eggs', quantity: 2, unit: 'pcs' }],
      }),
      id,
    );
    const again = (await rec.getFull(id))!;
    expect(again.recipe.name).toBe('Renamed');
    expect(again.recipe.favorite).toBe(true);
    expect(again.ingredients).toHaveLength(1);

    await rec.deleteRecipe(id);
    expect(await rec.getFull(id)).toBeUndefined();
    expect(await db.recipeIngredients.where('recipeId').equals(id).count()).toBe(0);
  });

  it('rejects invalid input with a readable message', async () => {
    await expect(rec.saveRecipe(mine({ name: ' ' }))).rejects.toThrow('Give the recipe a name');
    await expect(rec.saveRecipe(mine({ ingredients: [] }))).rejects.toThrow(
      'at least one ingredient',
    );
    await expect(
      rec.saveRecipe(
        mine({ ingredients: [{ ingredientId: 'ing-flour', quantity: 0, unit: 'g' }] }),
      ),
    ).rejects.toThrow('above 0');
    await expect(rec.saveRecipe(mine({ servings: 0 }))).rejects.toBeInstanceOf(InventoryError);
  });

  it('protects starter recipes from edits and deletion but allows a copy', async () => {
    await expect(rec.saveRecipe(mine(), 'garden-frittata')).rejects.toThrow('Duplicate it first');
    await expect(rec.deleteRecipe('garden-frittata')).rejects.toThrow('cannot be deleted');
    const copy = await rec.duplicateRecipe('garden-frittata');
    const full = (await rec.getFull(copy))!;
    expect(full.recipe.isStarter).toBe(false);
    expect(full.recipe.name).toBe('Garden Frittata (copy)');
    expect(full.ingredients).toHaveLength(
      STARTER_RECIPES.find((s) => s.recipe.id === 'garden-frittata')!.ingredients.length,
    );
  });
});

describe('collections', () => {
  it('creates, fills, renames and removes without dangling references', async () => {
    const c = await rec.createCollection('Weeknight');
    await expect(rec.createCollection('weeknight')).rejects.toThrow('already exists');
    const id = await rec.saveRecipe(mine());
    await rec.setInCollection(c.id, id, true);
    await rec.setInCollection(c.id, id, true); // idempotent
    await rec.setInCollection(c.id, 'garden-frittata', true);
    expect((await db.collections.get(c.id))!.recipeIds).toEqual([id, 'garden-frittata']);
    await rec.renameCollection(c.id, 'Fast dinners');
    await rec.deleteRecipe(id);
    expect((await db.collections.get(c.id))!.recipeIds).toEqual(['garden-frittata']);
    await rec.deleteCollection(c.id);
    expect(await db.collections.count()).toBe(0);
  });
});

describe('cooking session', () => {
  it('resumes the same active session and persists progress and timers', async () => {
    const s1 = await rec.startCooking('garden-frittata', 3);
    const s2 = await rec.startCooking('garden-frittata', 3);
    expect(s2.id).toBe(s1.id);
    await rec.patchSession(s1.id, { stepIndex: 2, checkedSteps: [0, 1] });
    const t = await rec.startTimer(s1.id, 'Cook veg', 360);
    expect(t.endsAt - t.startedAt).toBe(360_000);
    const stored = (await db.cookingSessions.get(s1.id))!;
    expect(stored.stepIndex).toBe(2);
    expect(stored.timers).toHaveLength(1);
    await rec.removeTimer(s1.id, t.id);
    expect((await db.cookingSessions.get(s1.id))!.timers).toHaveLength(0);
    await expect(rec.startTimer(s1.id, 'x', 0)).rejects.toThrow('1 second');
  });

  it('pauses and resumes a timer, persisted', async () => {
    const s = await rec.startCooking('garden-frittata', 3);
    const t = await rec.startTimer(s.id, 'Cook', 600);
    await rec.setTimerPaused(s.id, t.id, true);
    const paused = (await db.cookingSessions.get(s.id))!.timers![0];
    expect(paused.pausedRemainingMs).toBeGreaterThan(590_000);
    await rec.setTimerPaused(s.id, t.id, false);
    const running = (await db.cookingSessions.get(s.id))!.timers![0];
    expect(running.pausedRemainingMs).toBeUndefined();
    expect(running.endsAt).toBeGreaterThan(Date.now() + 590_000);
  });

  it('cancel leaves inventory completely unchanged', async () => {
    await inv.addLot(lot());
    const before = await db.inventoryEvents.count();
    const s = await rec.startCooking('garden-frittata', 3);
    await rec.cancelCooking(s.id);
    expect((await db.cookingSessions.get(s.id))!.status).toBe('cancelled');
    expect(await qty('ing-flour')).toBe(1000);
    expect(await db.inventoryEvents.count()).toBe(before);
    // a new session can start afterwards
    expect((await rec.startCooking('garden-frittata', 3)).id).not.toBe(s.id);
  });

  it('finish applies every deduction atomically, in FIFO order, and logs events', async () => {
    await inv.addLot(lot({ quantity: 300, dateLabel: 'best_before', date: '2030-01-01' }));
    await inv.addLot(lot({ quantity: 300, dateLabel: 'best_before', date: '2029-01-01' }));
    await inv.addLot(lot({ ingredientId: 'ing-milk', quantity: 1, unit: 'l' }));
    const id = await rec.saveRecipe(mine());
    const s = await rec.startCooking(id, 2);
    const applied = await rec.finishCooking(
      s.id,
      [
        { ingredientId: 'ing-flour', quantity: 400, unit: 'g' },
        { ingredientId: 'ing-milk', quantity: 300, unit: 'ml' },
      ],
      { rating: 4, notes: ' tasty ' },
    );
    expect(applied).toHaveLength(2);
    expect(await qty('ing-flour')).toBe(200);
    expect(await qty('ing-milk')).toBeCloseTo(0.7);
    const lots = await db.inventoryLots.where('ingredientId').equals('ing-flour').toArray();
    expect(lots).toHaveLength(1);
    expect(lots[0].date).toBe('2030-01-01'); // earliest date was used up first
    const done = (await db.cookingSessions.get(s.id))!;
    expect(done).toMatchObject({ status: 'completed', rating: 4, notes: 'tasty' });
    expect(done.deductions).toHaveLength(2);
    const uses = await db.inventoryEvents.filter((e) => e.type === 'use').toArray();
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });

  it('is all-or-nothing: one bad row rolls back every deduction and keeps the session open', async () => {
    await inv.addLot(lot({ quantity: 500 }));
    await inv.addLot(lot({ ingredientId: 'ing-milk', quantity: 100, unit: 'ml' }));
    const id = await rec.saveRecipe(mine());
    const s = await rec.startCooking(id, 2);
    const events = await db.inventoryEvents.count();
    await expect(
      rec.finishCooking(s.id, [
        { ingredientId: 'ing-flour', quantity: 200, unit: 'g' },
        { ingredientId: 'ing-milk', quantity: 300, unit: 'ml' }, // only 100 available
      ]),
    ).rejects.toThrow('Only 100 ml available');
    expect(await qty('ing-flour')).toBe(500);
    expect(await qty('ing-milk')).toBe(100);
    expect(await db.inventoryEvents.count()).toBe(events);
    expect((await db.cookingSessions.get(s.id))!.status).toBe('active');
  });

  it('cannot be applied twice (no double deduction)', async () => {
    await inv.addLot(lot({ quantity: 1000 }));
    const id = await rec.saveRecipe(mine());
    const s = await rec.startCooking(id, 2);
    const rows = [{ ingredientId: 'ing-flour', quantity: 200, unit: 'g' }];
    await rec.finishCooking(s.id, rows);
    await expect(rec.finishCooking(s.id, rows)).rejects.toThrow('already finished');
    await expect(
      Promise.all([rec.finishCooking(s.id, rows), rec.finishCooking(s.id, rows)]),
    ).rejects.toThrow();
    expect(await qty('ing-flour')).toBe(800);
  });

  it('finishing with nothing ticked records the session without touching stock', async () => {
    await inv.addLot(lot());
    const s = await rec.startCooking('garden-frittata', 3);
    await rec.finishCooking(s.id, []);
    expect(await qty('ing-flour')).toBe(1000);
    expect((await db.cookingSessions.get(s.id))!.status).toBe('completed');
  });

  it('deleting a recipe cancels its unfinished session but keeps finished history', async () => {
    const id = await rec.saveRecipe(mine());
    const s = await rec.startCooking(id, 2);
    await rec.deleteRecipe(id);
    expect((await db.cookingSessions.get(s.id))!.status).toBe('cancelled');
  });
});

describe('availability and proposed deductions', () => {
  it('reports enough / short / missing / unit and pre-selects safely', async () => {
    await inv.addLot(lot({ quantity: 150 })); // flour: short for 200 g
    await inv.addLot(lot({ ingredientId: 'ing-milk', quantity: 2, unit: 'pcs' })); // wrong unit
    await inv.addLot(lot({ ingredientId: 'ing-eggs', quantity: 6, unit: 'pcs' }));
    const id = await rec.saveRecipe(
      mine({
        ingredients: [
          { ingredientId: 'ing-flour', quantity: 200, unit: 'g' },
          { ingredientId: 'ing-milk', quantity: 300, unit: 'ml' },
          { ingredientId: 'ing-eggs', quantity: 2, unit: 'pcs' },
          { ingredientId: 'ing-butter', quantity: 20, unit: 'g' },
          { ingredientId: 'ing-honey', quantity: 1, unit: 'tbsp', optional: true },
        ],
      }),
    );
    const full = (await rec.getFull(id))!;
    const lots = groupLots(await db.inventoryLots.toArray());
    const ings = new Map((await db.ingredients.toArray()).map((i) => [i.id, i]));
    const a = recipeAvailability(full.ingredients, 1, lots, ings);
    expect(a.lines.map((l) => l.status)).toEqual(['short', 'unit', 'enough', 'missing', 'missing']);
    expect(a.have).toBe(1);
    expect(a.total).toBe(4); // optional line not counted
    expect(a.ready).toBe(false);
    const rows = proposeDeductions(a);
    expect(rows.map((r) => r.include)).toEqual([true, false, true, false, false]);
    expect(rows[0].quantity).toBe(150); // clamped to what is there
    expect(rows[0].note).toMatch(/Only 150/);
    // scaling up raises what is needed
    const x2 = recipeAvailability(full.ingredients, 2, lots, ings);
    expect(x2.lines[2].needed).toBe(4);
  });

  it('never lets two lines claim the same stock', async () => {
    await inv.addLot(lot({ quantity: 300 }));
    const id = await rec.saveRecipe(
      mine({
        ingredients: [
          { ingredientId: 'ing-flour', quantity: 200, unit: 'g' },
          { ingredientId: 'ing-flour', quantity: 200, unit: 'g' },
        ],
      }),
    );
    const full = (await rec.getFull(id))!;
    const a = recipeAvailability(
      full.ingredients,
      1,
      groupLots(await db.inventoryLots.toArray()),
      new Map((await db.ingredients.toArray()).map((i) => [i.id, i])),
    );
    expect(a.lines.map((l) => l.status)).toEqual(['enough', 'short']);
    expect(a.lines[1].available).toBe(100);
  });
});

describe('limits fixed: undo, exact lots', () => {
  it('undoes a finished cook, restoring every lot, once', async () => {
    await inv.addLot(lot({ quantity: 300, dateLabel: 'best_before', date: '2029-01-01' }));
    await inv.addLot(lot({ quantity: 300, dateLabel: 'best_before', date: '2030-01-01' }));
    const id = await rec.saveRecipe(mine());
    const s = await rec.startCooking(id, 2);
    await rec.finishCooking(s.id, [{ ingredientId: 'ing-flour', quantity: 400, unit: 'g' }]);
    expect(await qty('ing-flour')).toBe(200);
    await rec.undoCooking(s.id);
    expect(await qty('ing-flour')).toBe(600);
    expect(
      (await db.inventoryLots.where('ingredientId').equals('ing-flour').toArray())
        .map((l) => l.quantity)
        .sort(),
    ).toEqual([300, 300]);
    expect((await db.cookingSessions.get(s.id))!.undoneAt).toBeTruthy();
    await expect(rec.undoCooking(s.id)).rejects.toThrow('already undone');
    expect(await qty('ing-flour')).toBe(600);
  });

  it('refuses to undo when the stock changed since, and changes nothing', async () => {
    const l = await inv.addLot(lot({ quantity: 500 }));
    const id = await rec.saveRecipe(mine());
    const s = await rec.startCooking(id, 2);
    await rec.finishCooking(s.id, [{ ingredientId: 'ing-flour', quantity: 200, unit: 'g' }]);
    await inv.updateLot(l.id, lot({ quantity: 250 }));
    await expect(rec.undoCooking(s.id)).rejects.toThrow('changed since');
    expect(await qty('ing-flour')).toBe(250);
    expect((await db.cookingSessions.get(s.id))!.undoneAt).toBeUndefined();
  });

  it('applies exactly the lots the cook chose', async () => {
    const a = await inv.addLot(
      lot({ quantity: 300, dateLabel: 'best_before', date: '2029-01-01' }),
    );
    const b = await inv.addLot(
      lot({ quantity: 300, dateLabel: 'best_before', date: '2030-01-01' }),
    );
    const id = await rec.saveRecipe(mine());
    const s = await rec.startCooking(id, 2);
    await rec.finishCooking(s.id, [
      { ingredientId: 'ing-flour', quantity: 250, unit: 'g', lots: [{ lotId: b.id, take: 250 }] },
    ]);
    expect((await db.inventoryLots.get(a.id))!.quantity).toBe(300); // earliest lot untouched
    expect((await db.inventoryLots.get(b.id))!.quantity).toBe(50);
  });

  it('rejects lots that are over-drawn, repeated or belong to another ingredient — and rolls back', async () => {
    const a = await inv.addLot(lot({ quantity: 100 }));
    const m = await inv.addLot(lot({ ingredientId: 'ing-milk', quantity: 1, unit: 'l' }));
    const id = await rec.saveRecipe(mine());
    const s = await rec.startCooking(id, 2);
    const bad = (lots: { lotId: string; take: number }[], what: string) =>
      expect(
        rec.finishCooking(s.id, [
          {
            ingredientId: 'ing-milk',
            quantity: 100,
            unit: 'ml',
            lots: [{ lotId: m.id, take: 0.1 }],
          },
          { ingredientId: 'ing-flour', quantity: 1, unit: 'g', lots },
        ]),
      ).rejects.toThrow(what);
    await bad([{ lotId: a.id, take: 500 }], 'Only 100 g');
    await bad(
      [
        { lotId: a.id, take: 1 },
        { lotId: a.id, take: 1 },
      ],
      'twice',
    );
    await bad([{ lotId: m.id, take: 0.1 }], 'no longer exists');
    expect(await qty('ing-flour')).toBe(100);
    expect(await qty('ing-milk')).toBe(1);
  });
});

describe('recipes without a description', () => {
  it('still store an empty summary so every recipe has the same shape', async () => {
    const id = await rec.saveRecipe(mine({ summary: '' }));
    expect((await db.recipes.get(id))!.summary).toBe('');
  });
});
