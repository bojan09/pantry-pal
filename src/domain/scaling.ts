import { convert, unitDef } from './units';

/** Nearest "kitchen" fraction. Returns whole + fraction parts so 1.5 -> "1½". */
const FRACTIONS: [number, string][] = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
  [1, ''],
];

export function toFraction(q: number): string {
  if (!Number.isFinite(q) || q < 0) return '0';
  let whole = Math.floor(q);
  const frac = q - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  if (best[0] === 1) {
    whole += 1;
    best = FRACTIONS[0];
  }
  if (whole === 0 && best[1] === '') return '0';
  return `${whole > 0 ? whole : ''}${best[1]}`;
}

/** Scales a recipe amount. `factor` = wanted servings / recipe servings. */
export const scaleQuantity = (quantity: number, factor: number): number => quantity * factor;

const trimNum = (n: number, dp = 2) => Number(n.toFixed(dp)).toString();

export interface Shown {
  value: string;
  unit: string;
  /** number actually displayed, in `unit` */
  quantity: number;
}

/**
 * Picks a readable amount: metric weights/volumes round to sensible steps and promote
 * to kg / L; spoons and cups use kitchen fractions; counts use fractions too.
 * `system` converts mass/volume to the user's preferred measuring system.
 */
export function displayAmount(
  quantity: number,
  unit: string,
  system: 'metric' | 'imperial' = 'metric',
): Shown {
  const def = unitDef(unit);
  if (!def) return { value: trimNum(quantity), unit, quantity };
  let q = quantity;
  let u = unit;

  if (def.system !== 'both' && def.system !== system && def.dimension !== 'count') {
    if (def.dimension === 'mass') {
      const g = convert(q, u, 'g') ?? q;
      if (system === 'imperial') {
        const lb = g / 453.59237;
        [q, u] = lb >= 1 ? [lb, 'lb'] : [g / 28.349523125, 'oz'];
      } else {
        [q, u] = [g, 'g'];
      }
    } else {
      const ml = convert(q, u, 'ml') ?? q;
      if (system === 'imperial') {
        [q, u] = ml >= 236.5882365 / 2 ? [ml / 236.5882365, 'cup'] : [ml / 29.5735295625, 'floz'];
      } else {
        [q, u] = [ml, 'ml'];
      }
    }
  }

  if (u === 'g' && q >= 1000) [q, u] = [q / 1000, 'kg'];
  if (u === 'ml' && q >= 1000) [q, u] = [q / 1000, 'l'];

  const d = unitDef(u)!;
  if (u === 'g' || u === 'ml') {
    const r = q >= 100 ? Math.round(q / 5) * 5 : q >= 10 ? Math.round(q) : Number(q.toFixed(1));
    return { value: trimNum(r, 1), unit: u, quantity: r };
  }
  if (u === 'kg' || u === 'l' || u === 'lb') {
    return { value: trimNum(q, 2), unit: u, quantity: Number(q.toFixed(2)) };
  }
  if (u === 'oz' || u === 'floz') {
    return { value: trimNum(q, 1), unit: u, quantity: Number(q.toFixed(1)) };
  }
  // spoons, cups and counts: kitchen fractions
  if (d.dimension === 'volume' || d.dimension === 'count') {
    if (q > 0 && q < 1 / 16 && (u === 'tsp' || u === 'tbsp'))
      return { value: 'a pinch of', unit: '', quantity: q };
    const f = toFraction(q);
    return { value: f === '0' ? trimNum(q, 2) : f, unit: u, quantity: q };
  }
  return { value: trimNum(q), unit: u, quantity: q };
}

/** "1½ cups", "250 g", "a pinch of" ... */
export function formatAmount(
  quantity: number,
  unit: string,
  system: 'metric' | 'imperial' = 'metric',
): string {
  const s = displayAmount(quantity, unit, system);
  if (!s.unit) return s.value;
  const d = unitDef(s.unit);
  const one = Math.abs(s.quantity - 1) < 1e-9;
  const label = (!one && d?.plural) || d?.label || s.unit;
  return `${s.value} ${label}`;
}

/** Ingredients whose amounts rarely scale in a straight line. */
export function isNonLinear(category: string, name: string): boolean {
  return (
    category === 'Spices & Herbs' ||
    category === 'Baking' ||
    /\b(salt|pepper|yeast|baking (powder|soda))\b/i.test(name)
  );
}

export const clampServings = (n: number): number => Math.min(100, Math.max(1, Math.round(n)));
