import { beforeEach, describe, expect, it } from 'vitest';
import { PantryDB } from './db';
import { BACKUP_FORMAT, createBackup, fromBase64, toBase64, type BackupFile } from './backup';
import { createInventory, ensureCatalog } from './inventory';
import { createRecipes } from './recipes';
import { createPlanner } from './planner';
import { createShopping } from './shopping';
import { DEFAULT_PREFS } from '@/app/prefs';

let a: PantryDB;
let b: PantryDB;
const mk = async () => {
  const d = new PantryDB('b-' + Math.random());
  await ensureCatalog(d);
  await createRecipes(d).seedStarterRecipes();
  return d;
};

/** A device with at least one record in every table. */
async function populate(d: PantryDB) {
  const inv = createInventory(d);
  const rec = createRecipes(d);
  const shop = createShopping(d);
  const plan = createPlanner(d);
  const custom = await inv.createIngredient({
    name: 'Harissa',
    category: 'Oils & Sauces',
    defaultUnit: 'g',
  });
  const flour = await inv.addLot({
    ingredientId: 'ing-flour',
    quantity: 900,
    unit: 'g',
    zone: 'pantry',
    dateLabel: 'best_before',
    date: '2031-01-01',
  });
  await inv.addLot({
    ingredientId: custom.id,
    quantity: 100,
    unit: 'g',
    zone: 'fridge',
    dateLabel: 'unknown',
  });
  await inv.consume('ing-flour', 100, 'g');
  await d.mediaAssets.add({
    id: 'img1',
    kind: 'recipe',
    mime: 'image/jpeg',
    width: 4,
    height: 4,
    createdAt: 1,
    blob: new Blob([new Uint8Array([1, 2, 3, 250, 0, 7])], { type: 'image/jpeg' }),
  });
  const rid = await rec.saveRecipe({
    name: 'Mine',
    summary: 's',
    tags: ['a'],
    prepMinutes: 1,
    cookMinutes: 2,
    difficulty: 'easy',
    servings: 2,
    imageId: 'img1',
    ingredients: [{ ingredientId: custom.id, quantity: 10, unit: 'g' }],
    steps: [{ text: 'Do it', timerSeconds: 60 }],
  });
  await rec.setFavorite('garden-frittata', true);
  const col = await rec.createCollection('Fast');
  await rec.setInCollection(col.id, rid, true);
  await rec.setInCollection(col.id, 'garden-frittata', true);
  await plan.addEntry({ date: '2031-03-03', slot: 'dinner', recipeId: rid, servings: 2 });
  const list = await shop.createList('Weekly', 'EUR');
  await shop.addItem(list.id, {
    name: 'Milk',
    ingredientId: 'ing-milk',
    quantity: 1,
    unit: 'l',
    category: 'Dairy & Eggs',
    unitPrice: 1.2,
  });
  const s = await rec.startCooking('garden-frittata', 3);
  await rec.finishCooking(s.id, [{ ingredientId: 'ing-flour', quantity: 50, unit: 'g' }], {
    rating: 5,
    notes: 'nice',
  });
  return { flour, rid, col, list };
}

const dump = async (d: PantryDB) => ({
  ingredients: (await d.ingredients.filter((i) => i.isCustom).toArray()).sort((x, y) =>
    x.id.localeCompare(y.id),
  ),
  lots: (await d.inventoryLots.toArray()).sort((x, y) => x.id.localeCompare(y.id)),
  events: (await d.inventoryEvents.toArray()).sort((x, y) => x.id.localeCompare(y.id)),
  recipes: (await d.recipes.filter((r) => !r.isStarter).toArray()).sort((x, y) =>
    x.id.localeCompare(y.id),
  ),
  starFavs: (await d.recipes.filter((r) => r.isStarter && r.favorite).primaryKeys()).sort(),
  lines: (await d.recipeIngredients.toArray())
    .filter((l) => l.recipeId.length > 30)
    .sort((x, y) => x.id.localeCompare(y.id)),
  steps: (await d.recipeSteps.toArray())
    .filter((st) => st.recipeId.length > 30)
    .sort((x, y) => x.id.localeCompare(y.id)),
  cols: await d.collections.toArray(),
  plans: await d.mealPlans.toArray(),
  lists: await d.shoppingLists.toArray(),
  items: await d.shoppingItems.toArray(),
  sessions: await d.cookingSessions.toArray(),
  media: await Promise.all(
    (await d.mediaAssets.toArray()).map(async (m) => ({
      ...m,
      blob: [...new Uint8Array(await new Response(m.blob).arrayBuffer())],
      type: m.blob.type,
    })),
  ),
});

beforeEach(async () => {
  a = await mk();
  b = await mk();
});

describe('backup round trip', () => {
  it('exports every table and restores an identical copy on a fresh device', async () => {
    await populate(a);
    const { text, file } = await createBackup(a).exportBackup(DEFAULT_PREFS);
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    // starter recipes are not copied, only their favourite flag
    expect(file.data.recipes.every((r) => !r.isStarter)).toBe(true);
    expect(file.data.starterFavorites).toEqual(['garden-frittata']);

    const bk = createBackup(b);
    const { file: parsed, warnings } = await bk.parseBackup(text);
    expect(warnings).toEqual([]);
    const summary = await bk.restore(parsed, 'replace');
    expect(summary.inventoryLots.added).toBe(2);
    const [da, db2] = [await dump(a), await dump(b)];
    expect(db2).toEqual(da);
    expect((await b.recipes.get('garden-frittata'))!.favorite).toBe(true);
  });

  it('survives pretty-printing (checksum is over the data, not the whitespace)', async () => {
    await populate(a);
    const { file } = await createBackup(a).exportBackup(DEFAULT_PREFS);
    const pretty = JSON.stringify(file, null, 2);
    await expect(createBackup(b).parseBackup(pretty)).resolves.toBeTruthy();
  });

  it('round-trips photo bytes exactly', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => (i * 31) % 256);
    expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes]);
  });

  it('replace discards what was on the device; merge keeps it and adds only new records', async () => {
    const fx = await populate(a);
    const { text } = await createBackup(a).exportBackup(DEFAULT_PREFS);
    // device B has its own different data
    const invB = createInventory(b);
    await invB.addLot({
      ingredientId: 'ing-rice',
      quantity: 2,
      unit: 'kg',
      zone: 'pantry',
      dateLabel: 'unknown',
    });
    const bk = createBackup(b);
    const { file } = await bk.parseBackup(text);

    const merged = await bk.restore(file, 'merge');
    expect(merged.inventoryLots).toEqual({ added: 2, skipped: 0 });
    expect(await b.inventoryLots.count()).toBe(3); // rice kept
    const again = await bk.restore(file, 'merge'); // idempotent
    expect(again.inventoryLots).toEqual({ added: 0, skipped: 2 });
    expect(await b.inventoryLots.count()).toBe(3);
    expect(await b.recipeIngredients.where('recipeId').equals(fx.rid).count()).toBe(1);

    await bk.restore(file, 'replace');
    expect(await b.inventoryLots.count()).toBe(2); // rice gone
    expect(await b.inventoryLots.where('ingredientId').equals('ing-rice').count()).toBe(0);
  });

  it('merge never overwrites an existing record', async () => {
    const fx = await populate(a);
    const { text } = await createBackup(a).exportBackup(DEFAULT_PREFS);
    const bk = createBackup(a);
    await createInventory(a).updateLot(fx.flour.id, {
      ingredientId: 'ing-flour',
      quantity: 123,
      unit: 'g',
      zone: 'pantry',
      dateLabel: 'unknown',
    });
    const { file } = await bk.parseBackup(text);
    await bk.restore(file, 'merge');
    expect((await a.inventoryLots.get(fx.flour.id))!.quantity).toBe(123);
  });

  it('preview counts what is in the file, on the device and new', async () => {
    await populate(a);
    const { text } = await createBackup(a).exportBackup(DEFAULT_PREFS);
    const bk = createBackup(b);
    const { file } = await bk.parseBackup(text);
    const p = await bk.preview(file);
    const lots = p.lines.find((l) => l.key === 'inventoryLots')!;
    expect(lots).toMatchObject({ inFile: 2, onDevice: 0, isNew: 2 });
    await bk.restore(file, 'merge');
    expect((await bk.preview(file)).lines.find((l) => l.key === 'inventoryLots')).toMatchObject({
      inFile: 2,
      onDevice: 2,
      isNew: 0,
    });
  });

  it('wipe removes only user data and keeps the catalog and starter cookbook', async () => {
    await populate(a);
    await createBackup(a).wipe();
    expect(await a.inventoryLots.count()).toBe(0);
    expect(await a.shoppingItems.count()).toBe(0);
    expect(await a.mediaAssets.count()).toBe(0);
    expect(await a.ingredients.filter((i) => i.isCustom).count()).toBe(0);
    expect(await a.recipes.filter((r) => !r.isStarter).count()).toBe(0);
    expect(await a.recipes.count()).toBeGreaterThanOrEqual(33);
    expect((await a.recipes.get('garden-frittata'))!.favorite).toBe(false);
    expect(await a.ingredients.count()).toBeGreaterThan(90);
  });
});

describe('malformed or hostile files are rejected without touching data', () => {
  let text: string;
  let before: Awaited<ReturnType<typeof dump>>;
  beforeEach(async () => {
    await populate(a);
    text = (await createBackup(a).exportBackup(DEFAULT_PREFS)).text;
    await populate(b);
    before = await dump(b);
  });
  const rejects = async (t: string, msg: string | RegExp) => {
    await expect(createBackup(b).parseBackup(t)).rejects.toThrow(msg);
    expect(await dump(b)).toEqual(before); // nothing changed
  };
  const edit = (fn: (f: BackupFile) => void, keepChecksum = false) => {
    const f = JSON.parse(text) as BackupFile;
    fn(f);
    return JSON.stringify(f).replace(keepChecksum ? '' : '\u0000', '');
  };

  it('not JSON / wrong format / newer version / no checksum', async () => {
    await rejects('{{{', 'not valid JSON');
    await rejects('[]', /not a PantryPal backup/);
    await rejects(JSON.stringify({ format: 'something-else' }), /not a PantryPal backup/);
    await rejects(
      edit((f) => {
        f.version = 99;
      }),
      'newer version',
    );
    await rejects(
      edit((f) => {
        f.checksum = 'nope';
      }),
      'no valid checksum',
    );
  });

  it('any edit to the data breaks the checksum', async () => {
    await rejects(
      edit((f) => {
        f.data.inventoryLots[0].quantity = 5000;
      }),
      'checksum does not match',
    );
    await rejects(
      edit((f) => {
        f.data.collections = [];
      }),
      'checksum does not match',
    );
  });

  it('structurally invalid data is rejected even with a matching checksum', async () => {
    const forge = async (fn: (d: BackupFile['data']) => void) => {
      const f = JSON.parse(text) as BackupFile;
      fn(f.data);
      const bytes = new TextEncoder().encode(JSON.stringify(f.data));
      const h = await crypto.subtle.digest('SHA-256', bytes);
      f.checksum =
        'sha256:' + [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
      return JSON.stringify(f);
    };
    await rejects(
      await forge((d) => {
        d.inventoryLots[0].quantity = -3;
      }),
      /not valid/,
    );
    await rejects(
      await forge((d) => {
        d.inventoryLots[0].unit = 'bucket';
      }),
      /not valid/,
    );
    await rejects(
      await forge((d) => {
        d.inventoryLots[0].date = '31/12/2030';
      }),
      /not valid/,
    );
    await rejects(
      await forge((d) => {
        d.inventoryLots[0].ingredientId = 'ing-does-not-exist';
      }),
      /ingredient that is not in the backup/,
    );
    await rejects(
      await forge((d) => {
        d.inventoryLots.push({ ...d.inventoryLots[0] });
      }),
      /repeats an id/,
    );
    await rejects(
      await forge((d) => {
        d.shoppingItems[0].listId = 'ghost';
      }),
      /list that is not in the backup/,
    );
    await rejects(
      await forge((d) => {
        d.recipeSteps[0].recipeId = 'ghost';
      }),
      /recipe that is not in the backup/,
    );
    await rejects(
      await forge((d) => {
        d.mediaAssets[0].mime = 'text/html' as never;
      }),
      /not valid/,
    );
    await rejects(
      await forge((d) => {
        (d as unknown as { recipes: unknown }).recipes = 'oops';
      }),
      /not valid/,
    );
    await rejects(
      await forge((d) => {
        d.recipes[0].name = 'x'.repeat(5000);
      }),
      /not valid/,
    );
  });

  it('oversized text is refused before parsing', async () => {
    await expect(createBackup(b).parseBackup('x'.repeat(81 * 1024 * 1024))).rejects.toThrow(
      'too large',
    );
  });

  it('a failure part-way through restore rolls everything back', async () => {
    const bk = createBackup(b);
    const { file } = await bk.parseBackup(text);
    const orig = b.cookingSessions.bulkAdd.bind(b.cookingSessions);
    b.cookingSessions.bulkAdd = (async () => {
      throw new Error('disk full');
    }) as never;
    await expect(bk.restore(file, 'replace')).rejects.toThrow('disk full');
    b.cookingSessions.bulkAdd = orig as never;
    expect(await dump(b)).toEqual(before);
  });

  it('keeps soft references tidy and reports them', async () => {
    const f = JSON.parse(text) as BackupFile;
    f.data.collections[0].recipeIds.push('ghost-recipe');
    f.data.mealPlans.push({ ...f.data.mealPlans[0], id: 'plan-x', recipeId: 'ghost-recipe' });
    const bytes = new TextEncoder().encode(JSON.stringify(f.data));
    const h = await crypto.subtle.digest('SHA-256', bytes);
    f.checksum =
      'sha256:' + [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
    const { file, warnings } = await createBackup(b).parseBackup(JSON.stringify(f));
    expect(warnings.join(' ')).toMatch(/collection entry pointed at missing recipes/);
    expect(warnings.join(' ')).toMatch(/planned meal lost its recipe/);
    expect(file.data.collections[0].recipeIds).not.toContain('ghost-recipe');
    expect(file.data.mealPlans.find((p) => p.id === 'plan-x')).toMatchObject({
      label: 'Planned meal',
    });
  });
});
