import { z } from '@/lib/z';
import type { PantryDB } from './db';
import { db as defaultDb } from './db';
import { CATALOG } from './catalog';
import { InventoryError } from './inventory';
import { CURRENT_SCHEMA_VERSION } from './migrations';
import { STARTER_RECIPES } from './starterRecipes';
import type {
  Collection,
  CookingSession,
  Ingredient,
  InventoryEvent,
  InventoryLot,
  MealPlanEntry,
  MediaAsset,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  ShoppingItem,
  ShoppingList,
} from './types';
import { isKnownUnit } from '@/domain/units';
import { prefsSchema, type Prefs } from '@/app/prefs';

export const BACKUP_FORMAT = 'pantrypal.backup';
export const BACKUP_VERSION = 1;
/** Hard limits so a hostile or broken file cannot exhaust memory. */
export const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
const MAX_ROWS = 200_000;
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

/* ---------------------------------------------------------------- schemas */

const id = z.string().min(1).max(100);
const ts = z.number().finite();
const str = (n = 500) => z.string().max(n);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const unit = z.string().refine(isKnownUnit, 'Unknown unit');
const zone = z.enum(['pantry', 'fridge', 'freezer', 'custom']);
const stamped = { id, createdAt: ts, updatedAt: ts };

const ingredientS = z.object({
  ...stamped,
  name: str(80),
  aliases: z.array(str(80)).max(50),
  category: str(60),
  defaultUnit: unit,
  densityGPerMl: z.number().positive().max(100).optional(),
  allergens: z.array(str(40)).max(20),
  isCustom: z.literal(true),
  icon: str(40).optional(),
});

const lotS = z.object({
  ...stamped,
  ingredientId: id,
  quantity: z.number().min(0).max(1e7),
  unit,
  zone,
  customZoneName: str(60).optional(),
  purchasedOn: isoDate.optional(),
  openedOn: isoDate.optional(),
  dateLabel: z.enum(['use_by', 'best_before', 'unknown']),
  date: isoDate.optional(),
  packageSize: z.number().positive().max(1e7).optional(),
  lowStockThreshold: z.number().min(0).max(1e7).optional(),
  cost: z.number().min(0).max(1e9).optional(),
  currency: str(3).optional(),
  note: str(400).optional(),
  sample: z.boolean().optional(),
});

const eventS = z.object({
  id,
  lotId: id,
  ingredientId: id,
  type: z.enum(['add', 'use', 'transfer', 'discard', 'correct', 'purchase']),
  delta: z.number().finite(),
  unit: str(20),
  at: ts,
  idempotencyKey: str(200).optional(),
  note: str(400).optional(),
  snapshot: lotS.optional(),
});

const recipeS = z.object({
  ...stamped,
  name: str(80),
  summary: str(300).default(''),
  cuisine: str(40).optional(),
  category: str(40).optional(),
  tags: z.array(str(30)).max(12),
  prepMinutes: z.number().min(0).max(1440),
  cookMinutes: z.number().min(0).max(1440),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  servings: z.number().int().min(1).max(100),
  favorite: z.boolean(),
  isStarter: z.literal(false),
  imageId: id.optional(),
  art: str(30).optional(),
  notes: str(2000).optional(),
});
const recipeLineS = z.object({
  id,
  recipeId: id,
  ingredientId: id,
  quantity: z.number().positive().max(1e6),
  unit,
  optional: z.boolean().optional(),
  position: z.number().int().min(0).max(1000),
});
const recipeStepS = z.object({
  id,
  recipeId: id,
  position: z.number().int().min(0).max(1000),
  text: str(1000),
  timerSeconds: z.number().int().min(1).max(86_400).optional(),
});
const collectionS = z.object({ ...stamped, name: str(50), recipeIds: z.array(id).max(5000) });
const planS = z.object({
  ...stamped,
  date: isoDate,
  slot: str(30),
  recipeId: id.optional(),
  label: str(60).optional(),
  servings: z.number().int().min(1).max(100),
  position: z.number().int().min(0).max(1000),
  done: z.boolean().optional(),
});
const listS = z.object({
  ...stamped,
  name: str(50),
  currency: str(3),
  budget: z.number().min(0).max(1e9).optional(),
});
const itemS = z.object({
  ...stamped,
  listId: id,
  name: str(80),
  ingredientId: id.optional(),
  quantity: z.number().positive().max(1e7).optional(),
  unit: unit.optional(),
  category: str(60),
  checked: z.boolean(),
  unitPrice: z.number().min(0).max(1e9).optional(),
  note: str(400).optional(),
  stockedAt: ts.optional(),
});
const deductionS = z.object({
  ingredientId: id,
  quantity: z.number().min(0).max(1e7),
  unit,
  lots: z
    .array(z.object({ lotId: id, take: z.number().min(0).max(1e7) }))
    .max(500)
    .optional(),
  steps: z
    .array(
      z.object({
        lotId: id,
        take: z.number().min(0).max(1e7),
        remaining: z.number().min(0).max(1e7),
      }),
    )
    .max(500)
    .optional(),
  snapshots: z.array(lotS).max(500).optional(),
});
const sessionS = z.object({
  id,
  recipeId: id,
  recipeName: str(80).optional(),
  startedAt: ts,
  finishedAt: ts.optional(),
  servings: z.number().int().min(1).max(100),
  status: z.enum(['active', 'completed', 'cancelled']),
  stepIndex: z.number().int().min(0).max(1000).optional(),
  checkedIngredients: z.array(id).max(200).optional(),
  checkedSteps: z.array(z.number().int()).max(200).optional(),
  timers: z
    .array(
      z.object({
        id,
        label: str(60),
        durationSec: z.number().min(0).max(86_400),
        startedAt: ts,
        endsAt: ts,
        pausedRemainingMs: z.number().min(0).optional(),
        dismissed: z.boolean().optional(),
      }),
    )
    .max(50)
    .optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: str(600).optional(),
  deductions: z.array(deductionS).max(200).optional(),
  planEntryId: id.optional(),
  undoneAt: ts.optional(),
});
const mediaS = z.object({
  id,
  kind: z.enum(['background', 'recipe', 'avatar']),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
  createdAt: ts,
  /** base64 of the image bytes */
  data: z.string().max(Math.ceil((MAX_MEDIA_BYTES * 4) / 3) + 16),
});

const rows = <T extends z.ZodType>(s: T) => z.array(s).max(MAX_ROWS);

const dataS = z.object({
  ingredients: rows(ingredientS),
  inventoryLots: rows(lotS),
  inventoryEvents: rows(eventS),
  recipes: rows(recipeS),
  recipeIngredients: rows(recipeLineS),
  recipeSteps: rows(recipeStepS),
  /** starter recipes the user starred */
  starterFavorites: z.array(id).max(1000),
  collections: rows(collectionS),
  mealPlans: rows(planS),
  shoppingLists: rows(listS),
  shoppingItems: rows(itemS),
  cookingSessions: rows(sessionS),
  mediaAssets: rows(mediaS),
  prefs: z.unknown().optional(),
});
export type BackupData = z.infer<typeof dataS>;

const fileS = z.object({
  format: z.literal(BACKUP_FORMAT, { error: 'This is not a PantryPal backup file' }),
  version: z.number().int(),
  appVersion: str(30),
  schemaVersion: z.number().int(),
  createdAt: z.string().max(40),
  checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/, 'The backup has no valid checksum'),
  data: z.unknown(),
});

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  checksum: string;
  data: BackupData;
}

/* ---------------------------------------------------------------- helpers */

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function blobBytes(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await new Response(b).arrayBuffer());
}

const bad = (m: string) => new InventoryError(m, 'invalid');

/* ---------------------------------------------------------------- export */

export const COUNT_LABELS: Record<string, string> = {
  ingredients: 'Your own ingredients',
  inventoryLots: 'Pantry lots',
  inventoryEvents: 'Stock history entries',
  recipes: 'Your recipes',
  collections: 'Collections',
  mealPlans: 'Planned meals',
  shoppingLists: 'Shopping lists',
  shoppingItems: 'Shopping items',
  cookingSessions: 'Cooking history',
  mediaAssets: 'Photos',
};

export function createBackup(database: PantryDB = defaultDb) {
  /** Reads everything inside one read transaction so the file is a consistent snapshot. */
  async function exportBackup(
    prefs: Prefs,
    appVersion = '0.1.0',
  ): Promise<{ text: string; file: BackupFile }> {
    const snapshot = await database.transaction(
      'r',
      [
        database.ingredients,
        database.inventoryLots,
        database.inventoryEvents,
        database.recipes,
        database.recipeIngredients,
        database.recipeSteps,
        database.collections,
        database.mealPlans,
        database.shoppingLists,
        database.shoppingItems,
        database.cookingSessions,
        database.mediaAssets,
      ],
      async () => {
        const [
          ingredients,
          lots,
          events,
          recipes,
          lines,
          steps,
          cols,
          plans,
          lists,
          items,
          sessions,
          media,
        ] = await Promise.all([
          database.ingredients.filter((i) => i.isCustom).toArray(),
          database.inventoryLots.toArray(),
          database.inventoryEvents.toArray(),
          database.recipes.toArray(),
          database.recipeIngredients.toArray(),
          database.recipeSteps.toArray(),
          database.collections.toArray(),
          database.mealPlans.toArray(),
          database.shoppingLists.toArray(),
          database.shoppingItems.toArray(),
          database.cookingSessions.toArray(),
          database.mediaAssets.toArray(),
        ]);
        const mine = recipes.filter((r) => !r.isStarter);
        const mineIds = new Set(mine.map((r) => r.id));
        return {
          ingredients,
          inventoryLots: lots,
          inventoryEvents: events,
          recipes: mine,
          recipeIngredients: lines.filter((l) => mineIds.has(l.recipeId)),
          recipeSteps: steps.filter((s) => mineIds.has(s.recipeId)),
          starterFavorites: recipes.filter((r) => r.isStarter && r.favorite).map((r) => r.id),
          collections: cols,
          mealPlans: plans,
          shoppingLists: lists,
          shoppingItems: items,
          cookingSessions: sessions,
          media,
        };
      },
    );
    // Blob -> base64 happens after the read transaction: awaiting non-database work inside a
    // transaction would let the browser close it.
    const mediaAssets = [];
    for (const m of snapshot.media) {
      mediaAssets.push({
        id: m.id,
        kind: m.kind,
        mime: m.mime,
        width: m.width,
        height: m.height,
        createdAt: m.createdAt,
        data: toBase64(await blobBytes(m.blob)),
      });
    }
    const { media: _media, ...rest } = snapshot;
    void _media;
    const data = { ...rest, mediaAssets, prefs } as BackupData;
    const checksum = `sha256:${await sha256(JSON.stringify(data))}`;
    const file: BackupFile = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      appVersion,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      checksum,
      data,
    };
    return { text: JSON.stringify(file), file };
  }

  /* ------------------------------------------------------------ parse */

  /**
   * Validates a backup file completely before anything is touched: size, JSON, format, version,
   * checksum, every record's shape, and that records point at things that exist. Throws a
   * readable error otherwise.
   */
  async function parseBackup(text: string): Promise<{ file: BackupFile; warnings: string[] }> {
    if (text.length > MAX_BACKUP_BYTES)
      throw bad('That file is too large to be a PantryPal backup');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw bad('That is not valid JSON, so it cannot be a PantryPal backup');
    }
    if (!json || typeof json !== 'object' || Array.isArray(json))
      throw bad('This is not a PantryPal backup file');
    const head = fileS.safeParse(json);
    if (!head.success) throw bad(head.error.issues[0].message);
    const h = head.data;
    if (h.version > BACKUP_VERSION)
      throw bad(
        'This backup was made by a newer version of PantryPal. Update the app and try again.',
      );
    if (h.version < 1) throw bad('Unsupported backup version');
    const expected = await sha256(JSON.stringify(h.data));
    if (`sha256:${expected}` !== h.checksum)
      throw bad('The checksum does not match: the file was changed or damaged, so it was not used');
    const parsed = dataS.safeParse(h.data);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw bad(`The backup contents are not valid (${i.path.join(' › ')}: ${i.message})`);
    }
    const data = parsed.data;
    const warnings: string[] = [];

    // unique ids per table
    for (const [name, list] of Object.entries(data) as [string, unknown][]) {
      if (!Array.isArray(list) || name === 'starterFavorites') continue;
      const seen = new Set<string>();
      for (const r of list as { id?: string }[]) {
        if (!r.id) continue;
        if (seen.has(r.id)) throw bad(`The backup repeats an id in ${COUNT_LABELS[name] ?? name}`);
        seen.add(r.id);
      }
    }
    // references that must resolve
    const ingIds = new Set<string>([
      ...CATALOG.map((c) => c.id),
      ...(await database.ingredients.toCollection().primaryKeys()),
      ...data.ingredients.map((i) => i.id),
    ]);
    const recipeIds = new Set(data.recipes.map((r) => r.id));
    for (const l of data.inventoryLots)
      if (!ingIds.has(l.ingredientId))
        throw bad('A pantry lot refers to an ingredient that is not in the backup');
    for (const l of data.recipeIngredients) {
      if (!recipeIds.has(l.recipeId))
        throw bad('A recipe line refers to a recipe that is not in the backup');
      if (!ingIds.has(l.ingredientId))
        throw bad('A recipe line refers to an ingredient that is not in the backup');
    }
    for (const s of data.recipeSteps)
      if (!recipeIds.has(s.recipeId))
        throw bad('A recipe step refers to a recipe that is not in the backup');
    const listIds = new Set(data.shoppingLists.map((l) => l.id));
    for (const i of data.shoppingItems)
      if (!listIds.has(i.listId))
        throw bad('A shopping item refers to a list that is not in the backup');
    const mediaIds = new Set(data.mediaAssets.map((m) => m.id));
    for (const r of data.recipes)
      if (r.imageId && !mediaIds.has(r.imageId)) {
        r.imageId = undefined;
        warnings.push(`A photo for "${r.name}" was missing and was left out`);
      }
    for (const m of data.mediaAssets) {
      let bytes: number;
      try {
        bytes = fromBase64(m.data).length;
      } catch {
        throw bad('A photo in the backup is damaged');
      }
      if (bytes > MAX_MEDIA_BYTES) throw bad('A photo in the backup is too large');
    }
    // soft references: tidy up and say so
    const starterIds = new Set(STARTER_RECIPES.map((s) => s.recipe.id));
    const knownRecipe = (rid: string) => recipeIds.has(rid) || starterIds.has(rid);
    let dropped = 0;
    for (const c of data.collections) {
      const keep = c.recipeIds.filter(knownRecipe);
      dropped += c.recipeIds.length - keep.length;
      c.recipeIds = keep;
    }
    if (dropped)
      warnings.push(
        `${dropped} collection entr${dropped === 1 ? 'y' : 'ies'} pointed at missing recipes and ${dropped === 1 ? 'was' : 'were'} left out`,
      );
    let noted = 0;
    for (const p of data.mealPlans)
      if (p.recipeId && !knownRecipe(p.recipeId)) {
        p.label = p.label ?? 'Planned meal';
        p.recipeId = undefined;
        noted++;
      }
    if (noted)
      warnings.push(
        `${noted} planned meal${noted === 1 ? '' : 's'} lost ${noted === 1 ? 'its' : 'their'} recipe and became a note`,
      );
    data.starterFavorites = data.starterFavorites.filter((s) => starterIds.has(s));
    const p = prefsSchema.safeParse(data.prefs);
    data.prefs = p.success ? p.data : undefined;
    return { file: { ...h, data } as BackupFile, warnings };
  }

  /* ------------------------------------------------------------ preview */

  async function preview(file: BackupFile) {
    const d = file.data;
    const onDevice = {
      ingredients: await database.ingredients.filter((i) => i.isCustom).count(),
      inventoryLots: await database.inventoryLots.count(),
      inventoryEvents: await database.inventoryEvents.count(),
      recipes: await database.recipes.filter((r) => !r.isStarter).count(),
      collections: await database.collections.count(),
      mealPlans: await database.mealPlans.count(),
      shoppingLists: await database.shoppingLists.count(),
      shoppingItems: await database.shoppingItems.count(),
      cookingSessions: await database.cookingSessions.count(),
      mediaAssets: await database.mediaAssets.count(),
    };
    const newIn = async (table: keyof typeof onDevice, rows: { id: string }[]) => {
      const have = new Set(
        (await (
          database[table] as unknown as { toCollection(): { primaryKeys(): Promise<string[]> } }
        )
          .toCollection()
          .primaryKeys()) as string[],
      );
      return rows.filter((r) => !have.has(r.id)).length;
    };
    const rowsFor: Record<keyof typeof onDevice, { id: string }[]> = {
      ingredients: d.ingredients,
      inventoryLots: d.inventoryLots,
      inventoryEvents: d.inventoryEvents,
      recipes: d.recipes,
      collections: d.collections,
      mealPlans: d.mealPlans,
      shoppingLists: d.shoppingLists,
      shoppingItems: d.shoppingItems,
      cookingSessions: d.cookingSessions,
      mediaAssets: d.mediaAssets,
    };
    const lines = [];
    for (const k of Object.keys(onDevice) as (keyof typeof onDevice)[]) {
      lines.push({
        key: k,
        label: COUNT_LABELS[k],
        inFile: rowsFor[k].length,
        onDevice: onDevice[k],
        isNew: await newIn(k, rowsFor[k]),
      });
    }
    return { createdAt: file.createdAt, appVersion: file.appVersion, lines };
  }

  /* ------------------------------------------------------------ restore */

  const ALL = () => [
    database.ingredients,
    database.inventoryLots,
    database.inventoryEvents,
    database.recipes,
    database.recipeIngredients,
    database.recipeSteps,
    database.collections,
    database.mealPlans,
    database.shoppingLists,
    database.shoppingItems,
    database.cookingSessions,
    database.mediaAssets,
  ];

  const toMedia = (m: BackupData['mediaAssets'][number]): MediaAsset => ({
    id: m.id,
    kind: m.kind,
    mime: m.mime,
    width: m.width,
    height: m.height,
    createdAt: m.createdAt,
    blob: new Blob([fromBase64(m.data) as BlobPart], { type: m.mime }),
  });

  /**
   * Applies a validated backup in ONE transaction. `replace` swaps your data for the file's;
   * `merge` only adds records whose ids are not already here and never overwrites anything.
   * If any step fails, the transaction rolls back and nothing changes.
   */
  async function restore(file: BackupFile, mode: 'replace' | 'merge') {
    const d = file.data;
    const summary: Record<string, { added: number; skipped: number }> = {};
    await database.transaction('rw', ALL(), async () => {
      if (mode === 'replace') {
        await database.inventoryLots.clear();
        await database.inventoryEvents.clear();
        await database.collections.clear();
        await database.mealPlans.clear();
        await database.shoppingLists.clear();
        await database.shoppingItems.clear();
        await database.cookingSessions.clear();
        await database.mediaAssets.clear();
        await database.ingredients.filter((i) => i.isCustom).delete();
        const mine = await database.recipes.filter((r) => !r.isStarter).primaryKeys();
        await database.recipeIngredients.where('recipeId').anyOf(mine).delete();
        await database.recipeSteps.where('recipeId').anyOf(mine).delete();
        await database.recipes.bulkDelete(mine);
        await database.recipes.filter((r) => r.isStarter && r.favorite).modify({ favorite: false });
      }
      const put = async <T extends { id: string }>(
        name: string,
        table: {
          bulkAdd(rows: T[]): Promise<unknown>;
          bulkGet(ids: string[]): Promise<(T | undefined)[]>;
        },
        rows: T[],
      ) => {
        const have = mode === 'merge' ? await table.bulkGet(rows.map((r) => r.id)) : [];
        const fresh = rows.filter((_, i) => !have[i]);
        if (fresh.length) await table.bulkAdd(fresh);
        summary[name] = { added: fresh.length, skipped: rows.length - fresh.length };
        return new Set(fresh.map((r) => r.id));
      };
      await put<Ingredient>('ingredients', database.ingredients, d.ingredients as Ingredient[]);
      await put<MediaAsset>('mediaAssets', database.mediaAssets, d.mediaAssets.map(toMedia));
      const newRecipes = await put<Recipe>('recipes', database.recipes, d.recipes as Recipe[]);
      await database.recipeIngredients.bulkAdd(
        (d.recipeIngredients as RecipeIngredient[]).filter((l) => newRecipes.has(l.recipeId)),
      );
      await database.recipeSteps.bulkAdd(
        (d.recipeSteps as RecipeStep[]).filter((s) => newRecipes.has(s.recipeId)),
      );
      await put<InventoryLot>(
        'inventoryLots',
        database.inventoryLots,
        d.inventoryLots as InventoryLot[],
      );
      await put<InventoryEvent>(
        'inventoryEvents',
        database.inventoryEvents,
        d.inventoryEvents as InventoryEvent[],
      );
      await put<Collection>('collections', database.collections, d.collections as Collection[]);
      await put<MealPlanEntry>('mealPlans', database.mealPlans, d.mealPlans as MealPlanEntry[]);
      await put<ShoppingList>(
        'shoppingLists',
        database.shoppingLists,
        d.shoppingLists as ShoppingList[],
      );
      await put<ShoppingItem>(
        'shoppingItems',
        database.shoppingItems,
        d.shoppingItems as ShoppingItem[],
      );
      await put<CookingSession>(
        'cookingSessions',
        database.cookingSessions,
        d.cookingSessions as CookingSession[],
      );
      if (d.starterFavorites.length)
        await database.recipes
          .where('id')
          .anyOf(d.starterFavorites)
          .filter((r) => r.isStarter)
          .modify({ favorite: true });
    });
    return summary;
  }

  /** Removes every record the user created and returns the app to its first-run state. */
  async function wipe() {
    await database.transaction('rw', ALL(), async () => {
      await database.inventoryLots.clear();
      await database.inventoryEvents.clear();
      await database.collections.clear();
      await database.mealPlans.clear();
      await database.shoppingLists.clear();
      await database.shoppingItems.clear();
      await database.cookingSessions.clear();
      await database.mediaAssets.clear();
      await database.ingredients.filter((i) => i.isCustom).delete();
      const mine = await database.recipes.filter((r) => !r.isStarter).primaryKeys();
      await database.recipeIngredients.where('recipeId').anyOf(mine).delete();
      await database.recipeSteps.where('recipeId').anyOf(mine).delete();
      await database.recipes.bulkDelete(mine);
      await database.recipes.filter((r) => r.isStarter && r.favorite).modify({ favorite: false });
    });
  }

  return { exportBackup, parseBackup, preview, restore, wipe };
}

export const backup = createBackup();
