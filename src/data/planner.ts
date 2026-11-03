import { z } from 'zod';
import type { PantryDB } from './db';
import { db as defaultDb } from './db';
import { InventoryError } from './inventory';
import type { MealPlanEntry } from './types';
import { cellEntries, nextPosition } from '@/domain/planning';
import { addDays, fromISODate, toISODate } from '@/lib/dates';
import { newId } from '@/lib/ids';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const date = z.string().refine((s) => {
  if (!ISO.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}, 'Choose a valid date');

export const entrySchema = z
  .object({
    date,
    slot: z
      .string()
      .trim()
      .min(1, 'Choose a meal')
      .max(30, 'Keep the meal name under 30 characters'),
    recipeId: z.string().optional(),
    label: z.string().trim().max(60, 'Keep the note under 60 characters').optional(),
    servings: z.number({ error: 'Enter servings' }).int('Whole servings only').min(1).max(100),
  })
  .refine((v) => !!v.recipeId || !!v.label, {
    message: 'Pick a recipe or write a note such as "Leftovers"',
    path: ['recipeId'],
  });
export type EntryInput = z.input<typeof entrySchema>;

export function createPlanner(database: PantryDB = defaultDb) {
  const tables = [database.mealPlans, database.recipes] as const;

  async function check(input: EntryInput) {
    const p = entrySchema.safeParse(input);
    if (!p.success) throw new InventoryError(p.error.issues[0].message, 'invalid');
    return p.data;
  }

  async function addEntry(input: EntryInput): Promise<MealPlanEntry> {
    const v = await check(input);
    return database.transaction('rw', [...tables], async () => {
      if (v.recipeId && !(await database.recipes.get(v.recipeId)))
        throw new InventoryError('That recipe no longer exists', 'not_found');
      const day = await database.mealPlans.where('date').equals(v.date).toArray();
      const now = Date.now();
      const e: MealPlanEntry = {
        id: newId(),
        date: v.date,
        slot: v.slot,
        servings: v.servings,
        position: nextPosition(day, v.date, v.slot),
        createdAt: now,
        updatedAt: now,
        ...(v.recipeId ? { recipeId: v.recipeId } : { label: v.label }),
      };
      await database.mealPlans.add(e);
      return e;
    });
  }

  /** Changes servings, date, slot or note. Moving puts the entry at the end of its new cell. */
  async function updateEntry(
    id: string,
    patch: Partial<Pick<EntryInput, 'date' | 'slot' | 'servings' | 'label'>>,
  ) {
    return database.transaction('rw', [...tables], async () => {
      const cur = await database.mealPlans.get(id);
      if (!cur) throw new InventoryError('That entry no longer exists', 'not_found');
      const v = await check({
        date: patch.date ?? cur.date,
        slot: patch.slot ?? cur.slot,
        servings: patch.servings ?? cur.servings,
        recipeId: cur.recipeId,
        label: patch.label ?? cur.label,
      });
      const moved = v.date !== cur.date || v.slot !== cur.slot;
      const day = moved ? await database.mealPlans.where('date').equals(v.date).toArray() : [];
      await database.mealPlans.update(id, {
        date: v.date,
        slot: v.slot,
        servings: v.servings,
        ...(cur.recipeId ? {} : { label: v.label }),
        ...(moved ? { position: nextPosition(day, v.date, v.slot) } : {}),
        updatedAt: Date.now(),
      });
    });
  }

  async function duplicateEntry(id: string, to: { date: string; slot: string }) {
    const cur = await database.mealPlans.get(id);
    if (!cur) throw new InventoryError('That entry no longer exists', 'not_found');
    return addEntry({
      date: to.date,
      slot: to.slot,
      servings: cur.servings,
      recipeId: cur.recipeId,
      label: cur.label,
    });
  }

  /** Moves within the same meal: -1 = earlier, +1 = later. */
  async function reorder(id: string, dir: -1 | 1) {
    await database.transaction('rw', [...tables], async () => {
      const cur = await database.mealPlans.get(id);
      if (!cur) throw new InventoryError('That entry no longer exists', 'not_found');
      const cell = cellEntries(
        await database.mealPlans.where('date').equals(cur.date).toArray(),
        cur.date,
        cur.slot,
      );
      const i = cell.findIndex((e) => e.id === id);
      const j = i + dir;
      if (j < 0 || j >= cell.length) return;
      [cell[i], cell[j]] = [cell[j], cell[i]];
      for (const [k, e] of cell.entries()) await database.mealPlans.update(e.id, { position: k });
    });
  }

  /** Moves to a date/meal and inserts at `index` (end when omitted), renumbering the cell. */
  async function moveTo(id: string, to: { date: string; slot: string; index?: number }) {
    await database.transaction('rw', [...tables], async () => {
      const cur = await database.mealPlans.get(id);
      if (!cur) throw new InventoryError('That entry no longer exists', 'not_found');
      const v = await check({
        date: to.date,
        slot: to.slot,
        servings: cur.servings,
        recipeId: cur.recipeId,
        label: cur.label,
      });
      const day = await database.mealPlans.where('date').equals(v.date).toArray();
      const cell = cellEntries(day, v.date, v.slot).filter((e) => e.id !== id);
      const at = Math.max(0, Math.min(to.index ?? cell.length, cell.length));
      cell.splice(at, 0, cur);
      await database.mealPlans.update(id, { date: v.date, slot: v.slot, updatedAt: Date.now() });
      for (const [k, e] of cell.entries()) await database.mealPlans.update(e.id, { position: k });
    });
  }

  /** Repeats an entry every day or week, `count` more times. Returns how many were added. */
  async function repeatEntry(id: string, every: 'day' | 'week', count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 52)
      throw new InventoryError('Repeat between 1 and 52 times', 'invalid');
    const cur = await database.mealPlans.get(id);
    if (!cur) throw new InventoryError('That entry no longer exists', 'not_found');
    const step = every === 'day' ? 1 : 7;
    return database.transaction('rw', [...tables], async () => {
      for (let k = 1; k <= count; k++) {
        await addEntry({
          date: toISODate(addDays(fromISODate(cur.date), k * step)),
          slot: cur.slot,
          servings: cur.servings,
          recipeId: cur.recipeId,
          label: cur.label,
        });
      }
      return count;
    });
  }

  /** Copies every entry from one week to another (a reusable template week). */
  async function copyWeek(fromStart: string, toStart: string) {
    const offset = Math.round(
      (fromISODate(toStart).getTime() - fromISODate(fromStart).getTime()) / 86_400_000,
    );
    if (offset === 0) throw new InventoryError('Choose a different week to copy to', 'invalid');
    const end = toISODate(addDays(fromISODate(fromStart), 6));
    const src = await database.mealPlans
      .where('date')
      .between(fromStart, end, true, true)
      .toArray();
    if (!src.length) throw new InventoryError('That week has nothing planned to copy', 'not_found');
    return database.transaction('rw', [...tables], async () => {
      for (const e of src.sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)) {
        await addEntry({
          date: toISODate(addDays(fromISODate(e.date), offset)),
          slot: e.slot,
          servings: e.servings,
          recipeId: e.recipeId,
          label: e.label,
        });
      }
      return src.length;
    });
  }

  async function removeEntry(id: string) {
    await database.mealPlans.delete(id);
  }

  async function setDone(id: string, done: boolean) {
    const n = await database.mealPlans.update(id, { done, updatedAt: Date.now() });
    if (!n) throw new InventoryError('That entry no longer exists', 'not_found');
  }

  return {
    addEntry,
    updateEntry,
    duplicateEntry,
    reorder,
    moveTo,
    repeatEntry,
    copyWeek,
    removeEntry,
    setDone,
  };
}

export const planner = createPlanner();
