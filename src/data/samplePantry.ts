import type { PantryDB } from './db';
import { db as defaultDb } from './db';
import { createInventory, type LotInput } from './inventory';
import type { DateLabel, StorageZone } from './types';
import { addDays, toISODate } from '@/lib/dates';

type Row = [
  id: string,
  qty: number,
  unit: string,
  zone: StorageZone,
  label: DateLabel,
  inDays: number | null,
  low?: number,
];

/** Illustrative stock. Dates are relative to "today" so the sample always shows a realistic spread. */
const ROWS: Row[] = [
  ['tomatoes', 6, 'pcs', 'fridge', 'best_before', 2],
  ['milk', 1, 'l', 'fridge', 'use_by', 3, 0.5],
  ['spinach', 200, 'g', 'fridge', 'use_by', 4],
  ['chicken-breast', 500, 'g', 'fridge', 'use_by', 5],
  ['yogurt', 400, 'g', 'fridge', 'best_before', 6],
  ['eggs', 10, 'pcs', 'fridge', 'best_before', 14, 4],
  ['butter', 250, 'g', 'fridge', 'best_before', 30],
  ['cheese', 200, 'g', 'fridge', 'best_before', 20],
  ['pasta', 500, 'g', 'pantry', 'best_before', 240, 400],
  ['pasta', 500, 'g', 'pantry', 'best_before', 320],
  ['rice', 2000, 'g', 'pantry', 'best_before', 400],
  ['flour', 1500, 'g', 'pantry', 'best_before', 180],
  ['sugar', 800, 'g', 'pantry', 'unknown', null],
  ['olive-oil', 750, 'ml', 'pantry', 'best_before', 300],
  ['canned-tomatoes', 3, 'can', 'pantry', 'best_before', 500],
  ['canned-chickpeas', 2, 'can', 'pantry', 'best_before', 480],
  ['oats', 500, 'g', 'pantry', 'best_before', 150],
  ['honey', 350, 'g', 'pantry', 'unknown', null],
  ['salt', 500, 'g', 'pantry', 'unknown', null],
  ['paprika', 60, 'g', 'pantry', 'best_before', 200],
  ['lentils', 150, 'g', 'pantry', 'best_before', 260, 300],
  ['onions', 5, 'pcs', 'pantry', 'unknown', null],
  ['garlic', 3, 'pcs', 'pantry', 'unknown', null],
  ['potatoes', 2, 'kg', 'pantry', 'unknown', null],
  ['bananas', 4, 'pcs', 'pantry', 'unknown', null],
  ['bread', 1, 'pcs', 'pantry', 'best_before', -1],
  ['frozen-peas', 500, 'g', 'freezer', 'best_before', 200],
  ['frozen-berries', 300, 'g', 'freezer', 'best_before', 150],
  ['salmon', 400, 'g', 'freezer', 'use_by', 45],
];

export async function loadSamplePantry(
  database: PantryDB = defaultDb,
  today = new Date(),
): Promise<number> {
  const inv = createInventory(database);
  let n = 0;
  for (const [id, quantity, unit, zone, dateLabel, inDays, low] of ROWS) {
    const input: LotInput = {
      ingredientId: `ing-${id}`,
      quantity,
      unit,
      zone,
      dateLabel,
      date: inDays == null ? undefined : toISODate(addDays(today, inDays)),
      lowStockThreshold: low,
      note: 'Sample item',
    };
    await inv.addLot(input, { sample: true });
    n++;
  }
  return n;
}

export async function removeSamplePantry(database: PantryDB = defaultDb): Promise<number> {
  const lots = await database.inventoryLots.filter((l) => l.sample === true).toArray();
  await database.transaction('rw', database.inventoryLots, database.inventoryEvents, async () => {
    await database.inventoryLots.bulkDelete(lots.map((l) => l.id));
    await database.inventoryEvents
      .where('lotId')
      .anyOf(lots.map((l) => l.id))
      .delete();
  });
  return lots.length;
}
