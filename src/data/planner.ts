import { z } from 'zod';
import type { PantryDB } from './db';
import { db as defaultDb } from './db';
import { InventoryError } from './inventory';
import type { MealPlanEntry } from './types';
import { nextPosition } from '@/domain/planning';
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

  async function removeEntry(id: string) {
    await database.mealPlans.delete(id);
  }

  async function setDone(id: string, done: boolean) {
    const n = await database.mealPlans.update(id, { done, updatedAt: Date.now() });
    if (!n) throw new InventoryError('That entry no longer exists', 'not_found');
  }

  return { addEntry, updateEntry, duplicateEntry, removeEntry, setDone };
}

export const planner = createPlanner();
