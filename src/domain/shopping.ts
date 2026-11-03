import type { Ingredient, InventoryLot, RecipeIngredient, ShoppingItem } from '@/data/types';
import { CATEGORIES } from '@/data/catalog';
import { planConsume } from './lots';
import { scaleQuantity } from './scaling';
import { convert, dimensionOf, formatQuantity, tidy, unitDef, unitLabel } from './units';

export interface DemandInput {
  recipeName: string;
  lines: RecipeIngredient[];
  /** wanted servings / recipe servings */
  factor: number;
}

export interface NeedRow {
  key: string;
  ingredientId: string;
  name: string;
  category: string;
  unit: string;
  needed: number;
  inStock: number;
  onList: number;
  toBuy: number;
  /** recipes that asked for this ingredient */
  sources: string[];
  /** stock exists but in a unit that cannot be compared safely, so nothing was subtracted */
  stockNotComparable: boolean;
}

/** Group key: mass and (when density is known) volume merge to grams; counts stay per unit. */
function target(unit: string, density?: number): string {
  const d = dimensionOf(unit);
  if (d === 'mass') return 'g';
  if (d === 'volume') return density ? 'g' : 'ml';
  return unit;
}

/** Sums what the chosen recipes need, per ingredient, in comparable units only. */
export function aggregateDemand(inputs: DemandInput[], ingredients: Map<string, Ingredient>) {
  const rows = new Map<
    string,
    { ingredientId: string; unit: string; needed: number; sources: Set<string> }
  >();
  for (const inp of inputs) {
    for (const line of inp.lines) {
      if (line.optional) continue; // optional items are never added automatically
      const ing = ingredients.get(line.ingredientId);
      if (!ing) continue;
      const unit = target(line.unit, ing.densityGPerMl);
      const q = convert(
        scaleQuantity(line.quantity, inp.factor),
        line.unit,
        unit,
        ing.densityGPerMl,
      );
      if (q == null) continue;
      const key = `${line.ingredientId}|${unit}`;
      const row = rows.get(key) ?? {
        ingredientId: line.ingredientId,
        unit,
        needed: 0,
        sources: new Set<string>(),
      };
      row.needed += q;
      row.sources.add(inp.recipeName);
      rows.set(key, row);
    }
  }
  return [...rows.entries()].map(([key, r]) => ({ key, ...r, needed: tidy(r.needed) }));
}

/**
 * Needs = what the recipes require − what is in the pantry − what is already on the list.
 * Stock and list quantities are drawn down as rows are processed, so the same pantry grams are
 * never subtracted twice. Anything in an unrelated unit is left alone and flagged.
 */
export function buildNeeds(
  inputs: DemandInput[],
  ingredients: Map<string, Ingredient>,
  lots: InventoryLot[],
  listItems: ShoppingItem[],
): NeedRow[] {
  const work = lots.map((l) => ({ ...l }));
  const listWork = listItems
    .filter((i) => !i.checked && !i.stockedAt && i.ingredientId && i.quantity && i.unit)
    .map((i) => ({ ingredientId: i.ingredientId!, qty: i.quantity!, unit: i.unit! }));
  const out: NeedRow[] = [];
  for (const d of aggregateDemand(inputs, ingredients)) {
    const ing = ingredients.get(d.ingredientId)!;
    const mine = work.filter((l) => l.ingredientId === d.ingredientId);
    let inStock = 0;
    let stockNotComparable = false;
    const plan = planConsume(mine, d.needed, d.unit, ing.densityGPerMl);
    if (plan.ok) inStock = d.needed;
    else if (plan.reason === 'insufficient') inStock = plan.available ?? 0;
    else stockNotComparable = mine.length > 0;
    if (inStock > 0) {
      const take = planConsume(mine, inStock, d.unit, ing.densityGPerMl);
      if (take.ok)
        for (const s of take.steps) {
          const lot = work.find((l) => l.id === s.lotId)!;
          lot.quantity = s.remaining;
        }
    }
    let onList = 0;
    let stillNeeded = tidy(d.needed - inStock);
    for (const li of listWork) {
      if (stillNeeded <= 0) break;
      if (li.ingredientId !== d.ingredientId || li.qty <= 0) continue;
      const q = convert(li.qty, li.unit, d.unit, ing.densityGPerMl);
      if (q == null || q <= 0) continue;
      const use = Math.min(q, stillNeeded);
      onList += use;
      stillNeeded = tidy(stillNeeded - use);
      li.qty = tidy(li.qty - (convert(use, d.unit, li.unit, ing.densityGPerMl) ?? 0));
    }
    out.push({
      key: d.key,
      ingredientId: d.ingredientId,
      name: ing.name,
      category: ing.category,
      unit: d.unit,
      needed: d.needed,
      inStock: tidy(inStock),
      onList: tidy(onList),
      toBuy: Math.max(0, tidy(d.needed - inStock - onList)),
      sources: [...d.sources].sort(),
      stockNotComparable,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** "Need 500 g, have 200 g, already on list 100 g → buy 200 g" */
export function explainNeed(r: NeedRow): string {
  const f = (n: number) => formatQuantity(n, r.unit);
  const parts = [`Need ${f(r.needed)}`];
  if (r.inStock > 0) parts.push(`have ${f(r.inStock)}`);
  if (r.onList > 0) parts.push(`already on list ${f(r.onList)}`);
  if (r.stockNotComparable)
    parts.push(`your stock is in a unit that cannot be compared, so none was subtracted`);
  parts.push(r.toBuy > 0 ? `buy ${f(r.toBuy)}` : 'nothing to buy');
  return parts.join(', ');
}

/* ---------------- list helpers ---------------- */

export function groupByCategory<T extends { category: string }>(items: T[]): [string, T[]][] {
  const order = new Map<string, number>(CATEGORIES.map((c, i) => [c, i]));
  const m = new Map<string, T[]>();
  for (const i of items) {
    const a = m.get(i.category);
    if (a) a.push(i);
    else m.set(i.category, [i]);
  }
  return [...m.entries()].sort(
    (a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99) || a[0].localeCompare(b[0]),
  );
}

/** What a price is "per": kg for weights, L for liquids, otherwise the counted unit. */
export function priceBasis(unit: string | undefined): {
  unit: string;
  label: string;
  perUnit: number;
} {
  const d = unit ? unitDef(unit) : undefined;
  if (d?.dimension === 'mass') return { unit: 'kg', label: 'kg', perUnit: 1000 };
  if (d?.dimension === 'volume') return { unit: 'l', label: 'L', perUnit: 1000 };
  return { unit: unit ?? 'pcs', label: unit ? unitLabel(unit) : 'item', perUnit: 1 };
}

/** Estimated cost of one line, from the price the user typed. null when it cannot be known. */
export function lineCost(
  item: Pick<ShoppingItem, 'quantity' | 'unit' | 'unitPrice'>,
): number | null {
  if (item.unitPrice == null || !item.quantity) return null;
  const d = item.unit ? unitDef(item.unit) : undefined;
  if (!d) return item.unitPrice * item.quantity;
  if (d.dimension === 'count') return item.unitPrice * item.quantity;
  const base = item.quantity * d.factor; // g or ml
  return (item.unitPrice * base) / 1000;
}

export function estimateTotal(items: ShoppingItem[]): {
  total: number;
  priced: number;
  unpriced: number;
} {
  let total = 0;
  let priced = 0;
  for (const i of items) {
    const c = lineCost(i);
    if (c == null) continue;
    total += c;
    priced++;
  }
  return { total: Math.round(total * 100) / 100, priced, unpriced: items.length - priced };
}

/** Plain text for the share sheet or clipboard. */
export function shareText(
  name: string,
  items: ShoppingItem[],
  fmt: (i: ShoppingItem) => string,
): string {
  const lines = [name];
  for (const [cat, group] of groupByCategory(items.filter((i) => !i.stockedAt))) {
    lines.push('', cat);
    for (const i of group) lines.push(`${i.checked ? '[x]' : '[ ]'} ${fmt(i)}`);
  }
  return lines.join('\n');
}
