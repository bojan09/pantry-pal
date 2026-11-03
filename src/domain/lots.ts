import type { DateLabel, Ingredient, InventoryLot, StorageZone, UnitDimension } from '@/data/types';
import { convert, dimensionOf, tidy, unitOrder } from './units';

const EPS = 1e-9;

/** One total per incompatible kind of unit. Mass and volume are never added together. */
export interface Amount {
  /** 'mass' | 'volume' | `count:<unit>` */
  key: string;
  dimension: UnitDimension;
  /** g or ml for mass/volume; the unit itself for count */
  unit: string;
  /** in g / ml / count of `unit` */
  base: number;
}

export function totalsFor(lots: Pick<InventoryLot, 'quantity' | 'unit'>[]): Amount[] {
  const map = new Map<string, Amount>();
  for (const l of lots) {
    const dim = dimensionOf(l.unit);
    if (!dim) continue;
    let key: string;
    let unit: string;
    let value: number;
    if (dim === 'count') {
      key = `count:${l.unit}`;
      unit = l.unit;
      value = l.quantity;
    } else {
      key = dim;
      unit = dim === 'mass' ? 'g' : 'ml';
      value = convert(l.quantity, l.unit, unit) ?? 0;
    }
    const cur = map.get(key);
    if (cur) cur.base = tidy(cur.base + value);
    else map.set(key, { key, dimension: dim, unit, base: tidy(value) });
  }
  // Stable, readable order: weight, then volume, then counts ("500 g + 1 l + 3 pcs").
  const rank = { mass: 0, volume: 1, count: 2 } as const;
  return [...map.values()].sort(
    (a, b) => rank[a.dimension] - rank[b.dimension] || unitOrder(a.unit) - unitOrder(b.unit),
  );
}

// ---- dates ----------------------------------------------------------------

const DAY = 86_400_000;
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole calendar days from `today` to `date` (negative = already past). */
export const daysUntil = (date: string, today: string): number =>
  Math.round((parse(date) - parse(today)) / DAY);

export type ExpiryStatus = 'none' | 'ok' | 'soon' | 'expired';
const RANK: Record<ExpiryStatus, number> = { none: 0, ok: 1, soon: 2, expired: 3 };

export function expiryStatus(
  lot: Pick<InventoryLot, 'date' | 'dateLabel'>,
  today: string,
  leadDays: number,
): ExpiryStatus {
  if (!lot.date || lot.dateLabel === 'unknown') return 'none';
  const d = daysUntil(lot.date, today);
  if (d < 0) return 'expired';
  return d <= leadDays ? 'soon' : 'ok';
}

export const worstStatus = (a: ExpiryStatus, b: ExpiryStatus): ExpiryStatus =>
  RANK[a] >= RANK[b] ? a : b;

export const dateLabelText = (l: DateLabel): string =>
  l === 'use_by' ? 'Use by' : l === 'best_before' ? 'Best before' : 'No date';

/** Plain-language status. Never claims food is safe or unsafe. */
export function statusText(
  lot: Pick<InventoryLot, 'date' | 'dateLabel'>,
  today: string,
  leadDays: number,
): string {
  const st = expiryStatus(lot, today, leadDays);
  if (st === 'none' || !lot.date) return 'No date logged';
  const d = daysUntil(lot.date, today);
  const label = lot.dateLabel === 'use_by' ? 'use-by' : 'best-before';
  if (d < 0) return `Past ${label} date by ${-d} ${-d === 1 ? 'day' : 'days'}`;
  if (d === 0) return `${label[0].toUpperCase()}${label.slice(1)} date is today`;
  return `${d} ${d === 1 ? 'day' : 'days'} to ${label} date`;
}

/** Earliest-date first; lots without a date last; ties broken by creation time. */
export function byFirstExpiring<T extends Pick<InventoryLot, 'date' | 'dateLabel' | 'createdAt'>>(
  a: T,
  b: T,
): number {
  const ad = a.dateLabel !== 'unknown' && a.date ? a.date : null;
  const bd = b.dateLabel !== 'unknown' && b.date ? b.date : null;
  if (ad && bd) return ad === bd ? a.createdAt - b.createdAt : ad < bd ? -1 : 1;
  if (ad) return -1;
  if (bd) return 1;
  return a.createdAt - b.createdAt;
}

// ---- low stock ------------------------------------------------------------

/**
 * A lot may carry a low-stock threshold in its own unit. The ingredient is low when the
 * combined stock (only lots convertible to that unit) is at or below the threshold.
 */
export function isLowStock(lots: InventoryLot[], densityGPerMl?: number): boolean {
  for (const t of lots) {
    if (t.lowStockThreshold == null) continue;
    let total = 0;
    for (const l of lots) {
      const q = convert(l.quantity, l.unit, t.unit, densityGPerMl);
      if (q != null) total += q;
    }
    if (total <= t.lowStockThreshold + EPS) return true;
  }
  return false;
}

// ---- consume planning -----------------------------------------------------

export type ConsumePlan =
  | { ok: true; steps: { lotId: string; take: number; remaining: number }[] }
  | { ok: false; reason: 'invalid' | 'incompatible' | 'insufficient'; available?: number };

/**
 * Plans taking `quantity` of `unit` from an ingredient's lots, earliest date first.
 * Pure: it never mutates. Lots whose unit can't be safely converted are skipped.
 */
export function planConsume(
  lots: InventoryLot[],
  quantity: number,
  unit: string,
  densityGPerMl?: number,
): ConsumePlan {
  if (!Number.isFinite(quantity) || quantity <= 0 || !dimensionOf(unit)) {
    return { ok: false, reason: 'invalid' };
  }
  const usable = lots
    .map((l) => ({ lot: l, avail: convert(l.quantity, l.unit, unit, densityGPerMl) }))
    .filter((x): x is { lot: InventoryLot; avail: number } => x.avail != null && x.avail > EPS)
    .sort((a, b) => byFirstExpiring(a.lot, b.lot));
  if (!usable.length) return { ok: false, reason: 'incompatible' };

  const available = tidy(usable.reduce((s, x) => s + x.avail, 0));
  if (quantity > available + EPS) return { ok: false, reason: 'insufficient', available };

  let need = quantity;
  const steps: { lotId: string; take: number; remaining: number }[] = [];
  for (const { lot, avail } of usable) {
    if (need <= EPS) break;
    const takeReq = Math.min(need, avail);
    need = tidy(need - takeReq);
    const takeLot =
      takeReq === avail ? lot.quantity : (convert(takeReq, unit, lot.unit, densityGPerMl) ?? 0);
    const remaining = tidy(Math.max(0, lot.quantity - takeLot));
    steps.push({ lotId: lot.id, take: tidy(takeLot), remaining: remaining <= EPS ? 0 : remaining });
  }
  return { ok: true, steps };
}

// ---- per-ingredient summary ----------------------------------------------

export interface IngredientSummary {
  ingredient: Ingredient;
  lots: InventoryLot[];
  totals: Amount[];
  zones: StorageZone[];
  status: ExpiryStatus;
  nextLot?: InventoryLot;
  low: boolean;
}

export function summarize(
  ingredient: Ingredient,
  lots: InventoryLot[],
  today: string,
  leadDays: number,
): IngredientSummary {
  let status: ExpiryStatus = 'none';
  for (const l of lots) status = worstStatus(status, expiryStatus(l, today, leadDays));
  const dated = lots.filter((l) => l.date && l.dateLabel !== 'unknown').sort(byFirstExpiring);
  return {
    ingredient,
    lots,
    totals: totalsFor(lots),
    zones: [...new Set(lots.map((l) => l.zone))],
    status,
    nextLot: dated[0],
    low: isLowStock(lots, ingredient.densityGPerMl),
  };
}

export function groupByIngredient(
  ingredients: Ingredient[],
  lots: InventoryLot[],
  today: string,
  leadDays: number,
): IngredientSummary[] {
  const byIng = new Map<string, InventoryLot[]>();
  for (const l of lots) byIng.set(l.ingredientId, [...(byIng.get(l.ingredientId) ?? []), l]);
  return ingredients
    .filter((i) => byIng.has(i.id))
    .map((i) => summarize(i, byIng.get(i.id)!, today, leadDays));
}
