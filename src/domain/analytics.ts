import type {
  CookingSession,
  Ingredient,
  InventoryEvent,
  InventoryLot,
  MealPlanEntry,
  ShoppingItem,
  ShoppingList,
  StorageZone,
} from '@/data/types';
import { daysUntil } from './lots';
import { lineCost } from './shopping';
import { addDays, fromISODate, startOfWeek, toISODate, type WeekStart } from '@/lib/dates';

/**
 * Everything here is computed from records the user created: lots, cooking sessions, planned
 * meals, lists. Nothing is estimated or filled in, and each function says what it counts.
 */

export interface Filters {
  /** look-back window in days for activity charts; null = all time */
  rangeDays: number | null;
  category: string;
  zone: StorageZone | '';
}

export interface Slice {
  label: string;
  value: number;
}

const sortDesc = (a: Slice, b: Slice) => b.value - a.value || a.label.localeCompare(b.label);

/** Lots after the category and storage filters (pantry charts). */
export function filterLots(
  lots: InventoryLot[],
  ingredients: Map<string, Ingredient>,
  f: Pick<Filters, 'category' | 'zone'>,
): InventoryLot[] {
  return lots.filter(
    (l) =>
      (!f.zone || l.zone === f.zone) &&
      (!f.category || ingredients.get(l.ingredientId)?.category === f.category),
  );
}

/** Counts distinct ingredients per category (not quantities, which cannot be added across units). */
export function categoryComposition(
  lots: InventoryLot[],
  ingredients: Map<string, Ingredient>,
): Slice[] {
  const seen = new Map<string, Set<string>>();
  for (const l of lots) {
    const c = ingredients.get(l.ingredientId)?.category ?? 'Other';
    const s = seen.get(c) ?? new Set();
    s.add(l.ingredientId);
    seen.set(c, s);
  }
  return [...seen.entries()].map(([label, s]) => ({ label, value: s.size })).sort(sortDesc);
}

export function storageDistribution(lots: InventoryLot[]): Slice[] {
  const names: Record<StorageZone, string> = {
    pantry: 'Pantry',
    fridge: 'Fridge',
    freezer: 'Freezer',
    custom: 'Other places',
  };
  const count = new Map<StorageZone, number>();
  for (const l of lots) count.set(l.zone, (count.get(l.zone) ?? 0) + 1);
  return (['pantry', 'fridge', 'freezer', 'custom'] as StorageZone[])
    .filter((z) => count.has(z))
    .map((z) => ({ label: names[z], value: count.get(z)! }));
}

/** How many lots have their date in each window. Past dates and undated lots are separate. */
export function dateBuckets(lots: InventoryLot[], today: string): Slice[] {
  const b = { past: 0, d3: 0, d7: 0, d14: 0, d30: 0, later: 0, none: 0 };
  for (const l of lots) {
    if (!l.date || l.dateLabel === 'unknown') b.none++;
    else {
      const d = daysUntil(l.date, today);
      if (d < 0) b.past++;
      else if (d <= 3) b.d3++;
      else if (d <= 7) b.d7++;
      else if (d <= 14) b.d14++;
      else if (d <= 30) b.d30++;
      else b.later++;
    }
  }
  return [
    { label: 'Date has passed', value: b.past },
    { label: 'Within 3 days', value: b.d3 },
    { label: '4–7 days', value: b.d7 },
    { label: '8–14 days', value: b.d14 },
    { label: '15–30 days', value: b.d30 },
    { label: 'Later', value: b.later },
    { label: 'No date', value: b.none },
  ];
}

export function inRange(at: number, f: Pick<Filters, 'rangeDays'>, now: number): boolean {
  return f.rangeDays == null || at >= now - f.rangeDays * 86_400_000;
}

const counted = (s: CookingSession) => s.status === 'completed' && !s.undoneAt;

/** Finished, not-undone cooks inside the range. */
export function cooks(
  sessions: CookingSession[],
  f: Pick<Filters, 'rangeDays'>,
  now: number,
): CookingSession[] {
  return sessions.filter((s) => counted(s) && inRange(s.finishedAt ?? s.startedAt, f, now));
}

/** Cooks per week, oldest first, for `weeks` weeks ending with the current one. */
export function cooksPerWeek(
  sessions: CookingSession[],
  now: Date,
  weekStart: WeekStart,
  weeks: number,
): Slice[] {
  const thisWeek = startOfWeek(now, weekStart);
  const out: Slice[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = addDays(thisWeek, -7 * i);
    const to = addDays(from, 7);
    const n = sessions.filter(
      (s) =>
        counted(s) && (s.finishedAt ?? s.startedAt) >= +from && (s.finishedAt ?? s.startedAt) < +to,
    ).length;
    out.push({
      label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(from),
      value: n,
    });
  }
  return out;
}

/** Ingredients by how many finished cooks drew on them. */
export function topIngredients(
  sessions: CookingSession[],
  ingredients: Map<string, Ingredient>,
  category: string,
  limit = 8,
): Slice[] {
  const n = new Map<string, number>();
  for (const s of sessions)
    for (const id of new Set((s.deductions ?? []).map((d) => d.ingredientId))) {
      const ing = ingredients.get(id);
      if (!ing || (category && ing.category !== category)) continue;
      n.set(ing.name, (n.get(ing.name) ?? 0) + 1);
    }
  return [...n.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort(sortDesc)
    .slice(0, limit);
}

/** Per week: meals planned with a recipe, and how many different recipes they were. */
export function plannedVariety(
  entries: MealPlanEntry[],
  today: Date,
  weekStart: WeekStart,
  weeks: number,
): { label: string; planned: number; distinct: number }[] {
  const thisWeek = startOfWeek(today, weekStart);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = addDays(thisWeek, -7 * i);
    const a = toISODate(from);
    const b = toISODate(addDays(from, 6));
    const week = entries.filter((e) => e.recipeId && e.date >= a && e.date <= b);
    out.push({
      label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(from),
      planned: week.length,
      distinct: new Set(week.map((e) => e.recipeId)).size,
    });
  }
  return out;
}

export interface ListEstimate {
  list: string;
  currency: string;
  total: number;
  priced: number;
  unpriced: number;
  budget?: number;
}

/** One row per list, always in that list's own currency; never summed across lists. */
export function shoppingEstimates(lists: ShoppingList[], items: ShoppingItem[]): ListEstimate[] {
  return lists
    .map((l) => {
      const mine = items.filter((i) => i.listId === l.id && !i.stockedAt);
      let total = 0;
      let priced = 0;
      for (const i of mine) {
        const c = lineCost(i);
        if (c != null) {
          total += c;
          priced++;
        }
      }
      return {
        list: l.name,
        currency: l.currency,
        total: Math.round(total * 100) / 100,
        priced,
        unpriced: mine.length - priced,
        budget: l.budget,
      };
    })
    .filter((r) => r.priced > 0);
}

/**
 * Evidence of food used before its date: use events whose lot had a date that was still ahead
 * (or today) when it was used, and within `leadDays`. This only counts what the user recorded;
 * it does not claim anything was saved from the bin.
 */
export function usedBeforeDate(
  events: InventoryEvent[],
  ingredients: Map<string, Ingredient>,
  leadDays: number,
  f: Pick<Filters, 'rangeDays'>,
  now: number,
): { count: number; names: string[] } {
  const names = new Set<string>();
  let count = 0;
  for (const e of events) {
    if (e.type !== 'use' || !e.snapshot?.date || e.snapshot.dateLabel === 'unknown') continue;
    if (!inRange(e.at, f, now)) continue;
    const day = toISODate(new Date(e.at));
    const d = daysUntil(e.snapshot.date, day);
    if (d >= 0 && d <= leadDays) {
      count++;
      names.add(ingredients.get(e.ingredientId)?.name ?? 'Ingredient');
    }
  }
  return { count, names: [...names].sort() };
}

export const weekLabelRange = (d: Date, weekStart: WeekStart): string => {
  const s = startOfWeek(d, weekStart);
  return `${toISODate(s)} – ${toISODate(addDays(s, 6))}`;
};
export { fromISODate };
