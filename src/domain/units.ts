import type { UnitDimension } from '@/data/types';

export interface UnitDef {
  id: string;
  label: string;
  dimension: UnitDimension;
  /** multiplier to the dimension's base unit: g for mass, ml for volume, pcs for count */
  factor: number;
  system: 'metric' | 'imperial' | 'both';
}

export const UNITS: UnitDef[] = [
  { id: 'g', label: 'g', dimension: 'mass', factor: 1, system: 'metric' },
  { id: 'kg', label: 'kg', dimension: 'mass', factor: 1000, system: 'metric' },
  { id: 'oz', label: 'oz', dimension: 'mass', factor: 28.349523125, system: 'imperial' },
  { id: 'lb', label: 'lb', dimension: 'mass', factor: 453.59237, system: 'imperial' },
  { id: 'ml', label: 'ml', dimension: 'volume', factor: 1, system: 'metric' },
  { id: 'l', label: 'L', dimension: 'volume', factor: 1000, system: 'metric' },
  { id: 'tsp', label: 'tsp', dimension: 'volume', factor: 4.92892159375, system: 'both' },
  { id: 'tbsp', label: 'tbsp', dimension: 'volume', factor: 14.78676478125, system: 'both' },
  { id: 'cup', label: 'cup', dimension: 'volume', factor: 236.5882365, system: 'imperial' },
  { id: 'floz', label: 'fl oz', dimension: 'volume', factor: 29.5735295625, system: 'imperial' },
  { id: 'pcs', label: 'pcs', dimension: 'count', factor: 1, system: 'both' },
  { id: 'pack', label: 'pack', dimension: 'count', factor: 1, system: 'both' },
  { id: 'can', label: 'can', dimension: 'count', factor: 1, system: 'both' },
  { id: 'bottle', label: 'bottle', dimension: 'count', factor: 1, system: 'both' },
];

const BY_ID = new Map(UNITS.map((u) => [u.id, u]));

export const unitDef = (id: string): UnitDef | undefined => BY_ID.get(id);
export const isKnownUnit = (id: string): boolean => BY_ID.has(id);
export const dimensionOf = (id: string): UnitDimension | undefined => BY_ID.get(id)?.dimension;

/**
 * Converts between two units. Returns null when the conversion isn't safe:
 * unknown unit, different dimensions, or different count units. Mass<->volume is only
 * converted when an ingredient density (g/ml) is supplied.
 */
export function convert(
  quantity: number,
  from: string,
  to: string,
  densityGPerMl?: number,
): number | null {
  const a = unitDef(from);
  const b = unitDef(to);
  if (!a || !b || !Number.isFinite(quantity)) return null;
  if (from === to) return quantity;
  // Count units (pcs, pack, can, bottle) are distinct things: never convert between them.
  if (a.dimension === 'count' || b.dimension === 'count') return null;
  if (a.dimension === b.dimension) return (quantity * a.factor) / b.factor;
  if (!densityGPerMl || densityGPerMl <= 0) return null;
  if (a.dimension === 'mass' && b.dimension === 'volume') {
    return (quantity * a.factor) / densityGPerMl / b.factor;
  }
  return (quantity * a.factor * densityGPerMl) / b.factor;
}

export const canConvert = (from: string, to: string, density?: number): boolean =>
  convert(1, from, to, density) !== null;

/** Quantity in the dimension's base unit (g, ml) or null for count units. */
export function toBase(quantity: number, unit: string): number | null {
  const u = unitDef(unit);
  if (!u || u.dimension === 'count') return null;
  return quantity * u.factor;
}

/** Strips float noise like 0.30000000000000004 while keeping real precision (6 dp). */
export const tidy = (n: number): number => Number(n.toFixed(6));

const trim = (n: number, digits: number) => Number(n.toFixed(digits)).toString();

/** Formats a base amount (g or ml) in a readable unit for the chosen system. */
export function formatBase(
  base: number,
  dimension: Exclude<UnitDimension, 'count'>,
  system: 'metric' | 'imperial',
): string {
  if (dimension === 'mass') {
    if (system === 'metric')
      return base >= 1000 ? `${trim(base / 1000, 2)} kg` : `${trim(base, 0)} g`;
    const lb = base / 453.59237;
    return lb >= 1 ? `${trim(lb, 2)} lb` : `${trim(base / 28.349523125, 1)} oz`;
  }
  if (system === 'metric')
    return base >= 1000 ? `${trim(base / 1000, 2)} L` : `${trim(base, 0)} ml`;
  const cups = base / 236.5882365;
  return cups >= 1 ? `${trim(cups, 2)} cup` : `${trim(base / 29.5735295625, 1)} fl oz`;
}

export function formatQuantity(quantity: number, unit: string): string {
  const label = unitDef(unit)?.label ?? unit;
  return `${trim(quantity, 3)} ${label}`;
}

/** Units offered in forms for a given measurement preference. */
export function unitsForSystem(system: 'metric' | 'imperial'): UnitDef[] {
  return UNITS.filter((u) => u.system === 'both' || u.system === system);
}
