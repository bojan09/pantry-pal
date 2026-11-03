import type { MealPlanEntry } from '@/data/types';

export const STANDARD_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const slotLabel = (s: string): string =>
  (STANDARD_SLOTS as readonly string[]).includes(s) ? s[0].toUpperCase() + s.slice(1) : s;

/** Standard slots first, then any custom slot names that exist in the given entries. */
export function slotsFor(entries: Pick<MealPlanEntry, 'slot'>[]): string[] {
  const custom = [...new Set(entries.map((e) => e.slot))]
    .filter((s) => !(STANDARD_SLOTS as readonly string[]).includes(s))
    .sort((a, b) => a.localeCompare(b));
  return [...STANDARD_SLOTS, ...custom];
}

export function cellEntries(entries: MealPlanEntry[], date: string, slot: string): MealPlanEntry[] {
  return entries
    .filter((e) => e.date === date && e.slot === slot)
    .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
}

export function nextPosition(entries: MealPlanEntry[], date: string, slot: string): number {
  const cell = cellEntries(entries, date, slot);
  return cell.length ? Math.max(...cell.map((e) => e.position)) + 1 : 0;
}
