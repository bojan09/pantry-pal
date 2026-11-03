import type { PantryDB } from './db';
import { db as defaultDb } from './db';
import { CATALOG, CATALOG_VERSION } from './catalog';
import type { DateLabel, Ingredient, InventoryEvent, InventoryLot, StorageZone } from './types';
import { planConsume } from '@/domain/lots';
import { convert, dimensionOf, formatQuantity, isKnownUnit, tidy, unitLabel } from '@/domain/units';
import { newId } from '@/lib/ids';
import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s: string) => {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const dateField = z.string().refine(isRealDate, 'Enter a valid date');

export const ZONES: StorageZone[] = ['pantry', 'fridge', 'freezer', 'custom'];

export const lotInputSchema = z
  .object({
    ingredientId: z.string().min(1, 'Choose an ingredient'),
    quantity: z
      .number({ error: 'Enter a quantity' })
      .positive('Must be greater than 0')
      .max(1_000_000, 'That is too large'),
    unit: z.string().refine(isKnownUnit, 'Choose a unit'),
    zone: z.enum(ZONES),
    customZoneName: z.string().trim().max(30).optional(),
    purchasedOn: dateField.optional(),
    openedOn: dateField.optional(),
    dateLabel: z.enum(['use_by', 'best_before', 'unknown']),
    date: dateField.optional(),
    packageSize: z.number().positive().max(1_000_000).optional(),
    lowStockThreshold: z.number().min(0).max(1_000_000).optional(),
    cost: z.number().min(0).max(1_000_000).optional(),
    currency: z.string().max(3).optional(),
    note: z.string().trim().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.dateLabel !== 'unknown' && !v.date) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Enter the date from the package' });
    }
    if (v.zone === 'custom' && !v.customZoneName) {
      ctx.addIssue({ code: 'custom', path: ['customZoneName'], message: 'Name this place' });
    }
    if (v.purchasedOn && v.openedOn && v.openedOn < v.purchasedOn) {
      ctx.addIssue({
        code: 'custom',
        path: ['openedOn'],
        message: 'Opened date is before the purchase date',
      });
    }
  });
export type LotInput = z.infer<typeof lotInputSchema>;

export class InventoryError extends Error {
  constructor(
    message: string,
    public code: 'invalid' | 'not_found' | 'insufficient' | 'incompatible' | 'duplicate',
  ) {
    super(message);
  }
}

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

function event(
  lot: Pick<InventoryLot, 'id' | 'ingredientId' | 'unit'>,
  type: InventoryEvent['type'],
  delta: number,
  extra: Partial<InventoryEvent> = {},
): InventoryEvent {
  return {
    id: newId(),
    lotId: lot.id,
    ingredientId: lot.ingredientId,
    type,
    delta,
    unit: lot.unit,
    at: Date.now(),
    ...extra,
  };
}

/**
 * All stock mutations live here. Each runs in ONE Dexie transaction over lots + events,
 * so a failure anywhere (validation, quota, a thrown error) leaves stock untouched.
 */
export function createInventory(database: PantryDB = defaultDb) {
  const tx = <T>(fn: () => Promise<T>) =>
    database.transaction(
      'rw',
      database.inventoryLots,
      database.inventoryEvents,
      database.ingredients,
      fn,
    );

  async function addLot(
    input: LotInput,
    opts: { sample?: boolean; type?: 'add' | 'purchase'; idempotencyKey?: string } = {},
  ) {
    const parsed = lotInputSchema.safeParse(input);
    if (!parsed.success) throw new InventoryError(parsed.error.issues[0].message, 'invalid');
    const v = clean(parsed.data);
    return tx(async () => {
      if (!(await database.ingredients.get(v.ingredientId)))
        throw new InventoryError('Unknown ingredient', 'not_found');
      const now = Date.now();
      const lot: InventoryLot = {
        ...v,
        id: newId(),
        createdAt: now,
        updatedAt: now,
        ...(opts.sample ? { sample: true } : {}),
      } as InventoryLot;
      await database.inventoryLots.add(lot);
      await database.inventoryEvents.add(
        event(lot, opts.type ?? 'add', lot.quantity, { idempotencyKey: opts.idempotencyKey }),
      );
      return lot;
    });
  }

  /** Edits a lot. A changed quantity is recorded as a `correct` event so history stays honest. */
  async function updateLot(id: string, input: LotInput) {
    const parsed = lotInputSchema.safeParse(input);
    if (!parsed.success) throw new InventoryError(parsed.error.issues[0].message, 'invalid');
    const v = clean(parsed.data);
    return tx(async () => {
      const prev = await database.inventoryLots.get(id);
      if (!prev) throw new InventoryError('That item no longer exists', 'not_found');
      const next: InventoryLot = {
        ...v,
        id,
        createdAt: prev.createdAt,
        updatedAt: Date.now(),
        ...(prev.sample ? { sample: true } : {}),
      } as InventoryLot;
      await database.inventoryLots.put(next);
      const before = convert(prev.quantity, prev.unit, next.unit);
      const delta = before == null ? next.quantity : tidy(next.quantity - before);
      if (Math.abs(delta) > 1e-9 || prev.unit !== next.unit) {
        await database.inventoryEvents.add(
          event(next, 'correct', delta, { note: 'Edited', snapshot: prev }),
        );
      }
      return next;
    });
  }

  /**
   * Removes `quantity` of an ingredient across its lots, earliest date first. Atomic:
   * either every lot is updated and logged, or nothing changes.
   */
  async function consume(
    ingredientId: string,
    quantity: number,
    unit: string,
    opts: { idempotencyKey?: string; note?: string; type?: 'use' | 'discard' } = {},
  ) {
    return tx(async () => {
      if (
        opts.idempotencyKey &&
        (await database.inventoryEvents.where('idempotencyKey').equals(opts.idempotencyKey).first())
      ) {
        throw new InventoryError('This action was already applied', 'duplicate');
      }
      const ing = await database.ingredients.get(ingredientId);
      if (!ing) throw new InventoryError('Unknown ingredient', 'not_found');
      const lots = await database.inventoryLots
        .where('ingredientId')
        .equals(ingredientId)
        .toArray();
      const plan = planConsume(lots, quantity, unit, ing.densityGPerMl);
      if (!plan.ok) {
        const msg = {
          invalid: 'Enter a quantity greater than 0',
          incompatible: `You have no ${ing.name} that can be measured in ${unitLabel(unit)}`,
          insufficient: `Only ${formatQuantity(plan.available ?? 0, unit)} available`,
        }[plan.reason];
        throw new InventoryError(msg, plan.reason === 'invalid' ? 'invalid' : plan.reason);
      }
      const byId = new Map(lots.map((l) => [l.id, l]));
      const snapshots: InventoryLot[] = [];
      let first = true;
      for (const step of plan.steps) {
        const lot = byId.get(step.lotId)!;
        snapshots.push(lot);
        if (step.remaining === 0) await database.inventoryLots.delete(lot.id);
        else
          await database.inventoryLots.update(lot.id, {
            quantity: step.remaining,
            updatedAt: Date.now(),
          });
        await database.inventoryEvents.add(
          event(lot, opts.type ?? 'use', -step.take, {
            note: opts.note,
            snapshot: lot,
            // The key lives on one event so a repeat is rejected by the unique index.
            ...(first && opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
          }),
        );
        first = false;
      }
      return { steps: plan.steps, snapshots };
    });
  }

  /**
   * Removes exact amounts from chosen lots (each `take` is in that lot's own unit). Used when the
   * cook picks which lots were used. Atomic like `consume`.
   */
  async function consumeLots(
    ingredientId: string,
    picks: { lotId: string; take: number }[],
    opts: { idempotencyKey?: string; note?: string } = {},
  ) {
    return tx(async () => {
      if (
        opts.idempotencyKey &&
        (await database.inventoryEvents.where('idempotencyKey').equals(opts.idempotencyKey).first())
      )
        throw new InventoryError('This action was already applied', 'duplicate');
      const steps: { lotId: string; take: number; remaining: number }[] = [];
      const snapshots: InventoryLot[] = [];
      let first = true;
      const seen = new Set<string>();
      for (const p of picks) {
        if (!(p.take > 0)) continue;
        if (seen.has(p.lotId)) throw new InventoryError('A lot was chosen twice', 'invalid');
        seen.add(p.lotId);
        const lot = await database.inventoryLots.get(p.lotId);
        if (!lot || lot.ingredientId !== ingredientId)
          throw new InventoryError('A chosen lot no longer exists', 'not_found');
        if (p.take > lot.quantity + 1e-9)
          throw new InventoryError(
            `Only ${formatQuantity(lot.quantity, lot.unit)} in that lot`,
            'insufficient',
          );
        const remaining = tidy(Math.max(0, lot.quantity - p.take));
        if (remaining <= 1e-9) await database.inventoryLots.delete(lot.id);
        else
          await database.inventoryLots.update(lot.id, {
            quantity: remaining,
            updatedAt: Date.now(),
          });
        await database.inventoryEvents.add(
          event(lot, 'use', -p.take, {
            note: opts.note,
            snapshot: lot,
            ...(first && opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
          }),
        );
        first = false;
        steps.push({
          lotId: lot.id,
          take: tidy(p.take),
          remaining: remaining <= 1e-9 ? 0 : remaining,
        });
        snapshots.push(lot);
      }
      if (!steps.length)
        throw new InventoryError('Choose how much to use from at least one lot', 'invalid');
      return { steps, snapshots };
    });
  }

  /** Moves some or all of a lot to another zone. A partial move splits the lot. */
  async function transfer(
    lotId: string,
    zone: StorageZone,
    customZoneName: string | undefined,
    quantity?: number,
  ) {
    return tx(async () => {
      const lot = await database.inventoryLots.get(lotId);
      if (!lot) throw new InventoryError('That item no longer exists', 'not_found');
      const qty = quantity ?? lot.quantity;
      if (!Number.isFinite(qty) || qty <= 0)
        throw new InventoryError('Enter a quantity greater than 0', 'invalid');
      if (qty > lot.quantity + 1e-9)
        throw new InventoryError(
          `Only ${formatQuantity(lot.quantity, lot.unit)} available`,
          'insufficient',
        );
      if (zone === 'custom' && !customZoneName?.trim())
        throw new InventoryError('Name this place', 'invalid');
      const name = zone === 'custom' ? customZoneName!.trim() : undefined;
      const now = Date.now();
      if (Math.abs(qty - lot.quantity) <= 1e-9) {
        await database.inventoryLots.put(
          clean({ ...lot, zone, customZoneName: name, updatedAt: now }) as InventoryLot,
        );
        await database.inventoryEvents.add(
          event(lot, 'transfer', 0, { note: `Moved to ${zone}`, snapshot: lot }),
        );
        return lot.id;
      }
      const moved: InventoryLot = clean({
        ...lot,
        id: newId(),
        quantity: qty,
        zone,
        customZoneName: name,
        createdAt: now,
        updatedAt: now,
      }) as InventoryLot;
      await database.inventoryLots.update(lot.id, {
        quantity: tidy(lot.quantity - qty),
        updatedAt: now,
      });
      await database.inventoryLots.add(moved);
      await database.inventoryEvents.add(
        event(moved, 'transfer', 0, { note: `Moved ${qty} ${lot.unit} to ${zone}`, snapshot: lot }),
      );
      return moved.id;
    });
  }

  /** Discards a whole lot (kept in history, restorable via undo). */
  async function discardLot(lotId: string, note?: string) {
    return tx(async () => {
      const lot = await database.inventoryLots.get(lotId);
      if (!lot) throw new InventoryError('That item no longer exists', 'not_found');
      await database.inventoryLots.delete(lotId);
      const ev = event(lot, 'discard', -lot.quantity, { note, snapshot: lot });
      await database.inventoryEvents.add(ev);
      return { lot, eventId: ev.id };
    });
  }

  /**
   * Undoes a use/discard by restoring the lots it removed or reduced. Safe: refuses if the lot
   * was changed since (so it can never create stock out of thin air), and each event is
   * undone at most once.
   */
  async function undo(snapshots: InventoryLot[], steps?: { lotId: string; take: number }[]) {
    return tx(async () => {
      for (const snap of snapshots) {
        const cur = await database.inventoryLots.get(snap.id);
        const step = steps?.find((s) => s.lotId === snap.id);
        if (cur) {
          if (!step)
            throw new InventoryError(
              'That item changed since, so it cannot be restored',
              'invalid',
            );
          const restored = tidy(cur.quantity + step.take);
          if (Math.abs(restored - snap.quantity) > 1e-6)
            throw new InventoryError(
              'That item changed since, so it cannot be restored',
              'invalid',
            );
          await database.inventoryLots.update(snap.id, {
            quantity: restored,
            updatedAt: Date.now(),
          });
        } else {
          await database.inventoryLots.add({ ...snap, updatedAt: Date.now() });
        }
        await database.inventoryEvents.add(
          event(snap, 'correct', step?.take ?? snap.quantity, { note: 'Undo' }),
        );
      }
    });
  }

  /** Discards several lots in one transaction and returns them so the caller can offer undo. */
  async function deleteLotsBulk(ids: string[]) {
    return tx(async () => {
      const removed: InventoryLot[] = [];
      for (const id of ids) {
        const lot = await database.inventoryLots.get(id);
        if (!lot) continue;
        await database.inventoryLots.delete(id);
        await database.inventoryEvents.add(event(lot, 'discard', -lot.quantity, { snapshot: lot }));
        removed.push(lot);
      }
      return removed;
    });
  }

  /** All-or-nothing: one bad lot rolls the whole move back. */
  async function transferBulk(ids: string[], zone: StorageZone, customZoneName?: string) {
    return tx(async () => {
      for (const id of ids) await transfer(id, zone, customZoneName);
    });
  }

  async function createIngredient(input: { name: string; category: string; defaultUnit: string }) {
    const name = input.name.trim();
    if (!name || name.length > 60)
      throw new InventoryError('Enter a name (up to 60 characters)', 'invalid');
    if (!isKnownUnit(input.defaultUnit)) throw new InventoryError('Choose a unit', 'invalid');
    const existing = await database.ingredients.where('name').equalsIgnoreCase(name).first();
    if (existing) throw new InventoryError(`"${existing.name}" already exists`, 'duplicate');
    const now = Date.now();
    const ing: Ingredient = {
      id: newId(),
      name,
      aliases: [],
      category: input.category,
      defaultUnit: input.defaultUnit,
      allergens: [],
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    };
    await database.ingredients.add(ing);
    return ing;
  }

  return {
    addLot,
    updateLot,
    consume,
    consumeLots,
    transfer,
    discardLot,
    undo,
    deleteLotsBulk,
    transferBulk,
    createIngredient,
  };
}

export const inventory = createInventory();

/** Seeds the built-in ingredient catalog once per catalog version. Never overwrites user edits. */
export async function ensureCatalog(database: PantryDB = defaultDb): Promise<number> {
  const row = await database.preferences.get('catalogVersion');
  if (row?.value === CATALOG_VERSION) return 0;
  const existing = new Map((await database.ingredients.toArray()).map((i) => [i.id, i]));
  const now = Date.now();
  const missing = CATALOG.filter((c) => !existing.has(c.id)).map((c) => ({
    ...c,
    createdAt: now,
    updatedAt: now,
  }));
  // Built-in items get the current usual unit (e.g. ajvar moved from grams to jars). Custom
  // ingredients and existing lots are never touched.
  const refreshed = CATALOG.filter((c) => {
    const have = existing.get(c.id);
    return have && !have.isCustom && have.defaultUnit !== c.defaultUnit;
  });
  await database.transaction('rw', database.ingredients, database.preferences, async () => {
    if (missing.length) await database.ingredients.bulkAdd(missing);
    for (const c of refreshed)
      await database.ingredients.update(c.id, { defaultUnit: c.defaultUnit, updatedAt: now });
    await database.preferences.put({ key: 'catalogVersion', value: CATALOG_VERSION });
  });
  return missing.length;
}

export const dimensionLabel = (unit: string) => dimensionOf(unit) ?? 'count';
export type { DateLabel };
