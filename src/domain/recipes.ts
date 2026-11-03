import type { Ingredient, InventoryLot, Recipe, RecipeIngredient } from '@/data/types';
import { planConsume } from './lots';
import { scaleQuantity } from './scaling';
import { convert, formatQuantity, tidy } from './units';

export type Availability = 'enough' | 'short' | 'missing' | 'unit';

export interface LineAvailability {
  line: RecipeIngredient;
  /** amount needed for the chosen servings, in the recipe line's unit */
  needed: number;
  status: Availability;
  /** usable stock in the line's unit (set when convertible) */
  available?: number;
}

export interface RecipeAvailability {
  lines: LineAvailability[];
  /** required (non-optional) lines fully covered */
  have: number;
  /** required lines */
  total: number;
  ready: boolean;
}

type LotsByIngredient = Map<string, InventoryLot[]>;

export function groupLots(lots: InventoryLot[]): LotsByIngredient {
  const m: LotsByIngredient = new Map();
  for (const l of lots) {
    const a = m.get(l.ingredientId);
    if (a) a.push(l);
    else m.set(l.ingredientId, [l]);
  }
  return m;
}

/**
 * Compares each line with stock. Lines are checked in order against a working copy of the
 * stock, so two lines using the same ingredient can never both claim the same grams.
 * Stock in a unit that cannot be converted safely (e.g. spice jar vs teaspoons) is reported
 * as `unit` rather than guessed.
 */
export function recipeAvailability(
  lines: RecipeIngredient[],
  factor: number,
  lotsByIng: LotsByIngredient,
  ingredients: Map<string, Ingredient>,
): RecipeAvailability {
  const work = new Map<string, InventoryLot[]>();
  for (const [k, v] of lotsByIng)
    work.set(
      k,
      v.map((l) => ({ ...l })),
    );
  const out: LineAvailability[] = [];
  for (const line of lines) {
    const needed = scaleQuantity(line.quantity, factor);
    const lots = work.get(line.ingredientId) ?? [];
    const density = ingredients.get(line.ingredientId)?.densityGPerMl;
    const plan = planConsume(lots, needed, line.unit, density);
    if (plan.ok) {
      for (const s of plan.steps) {
        const lot = lots.find((l) => l.id === s.lotId)!;
        lot.quantity = s.remaining;
      }
      out.push({ line, needed, status: 'enough' });
    } else if (plan.reason === 'insufficient') {
      out.push({ line, needed, status: 'short', available: plan.available });
    } else {
      out.push({ line, needed, status: lots.length ? 'unit' : 'missing' });
    }
  }
  const required = out.filter((l) => !l.line.optional);
  const have = required.filter((l) => l.status === 'enough').length;
  return { lines: out, have, total: required.length, ready: have === required.length };
}

export interface DeductionRow {
  ingredientId: string;
  include: boolean;
  quantity: number;
  unit: string;
  /** why the row is not pre-selected, or what was adjusted */
  note?: string;
}

/**
 * The deductions the cook is asked to confirm. Nothing here touches stock: the user can
 * edit amounts and untick rows first. Rows we cannot match to stock start unticked.
 */
export function proposeDeductions(avail: RecipeAvailability): DeductionRow[] {
  return avail.lines.map(({ line, needed, status, available }) => {
    const base = { ingredientId: line.ingredientId, unit: line.unit };
    switch (status) {
      case 'enough':
        return { ...base, quantity: tidy(needed), include: !line.optional };
      case 'short':
        return {
          ...base,
          quantity: tidy(available ?? 0),
          include: !line.optional,
          note: `Only ${formatQuantity(available ?? 0, line.unit)} on hand — the recipe wanted ${formatQuantity(needed, line.unit)}`,
        };
      case 'unit':
        return {
          ...base,
          quantity: tidy(needed),
          include: false,
          note: 'Your stock is in a unit that cannot be compared safely. Pick a unit to use.',
        };
      default:
        return { ...base, quantity: tidy(needed), include: false, note: 'Not in your pantry' };
    }
  });
}

export interface RecipeFilters {
  q: string;
  favoritesOnly: boolean;
  category: string;
  cuisine: string;
  difficulty: string;
  maxMinutes: number | null;
  collectionRecipeIds: Set<string> | null;
}

export const emptyFilters: RecipeFilters = {
  q: '',
  favoritesOnly: false,
  category: '',
  cuisine: '',
  difficulty: '',
  maxMinutes: null,
  collectionRecipeIds: null,
};

export const totalMinutes = (r: Pick<Recipe, 'prepMinutes' | 'cookMinutes'>): number =>
  r.prepMinutes + r.cookMinutes;

/** Title, summary, tags, cuisine, category and ingredient names (with aliases) all match. */
export function matchesRecipe(r: Recipe, ingredientTerms: string[], f: RecipeFilters): boolean {
  if (f.favoritesOnly && !r.favorite) return false;
  if (f.category && r.category !== f.category) return false;
  if (f.cuisine && r.cuisine !== f.cuisine) return false;
  if (f.difficulty && r.difficulty !== f.difficulty) return false;
  if (f.maxMinutes != null && totalMinutes(r) > f.maxMinutes) return false;
  if (f.collectionRecipeIds && !f.collectionRecipeIds.has(r.id)) return false;
  const terms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = [r.name, r.summary, r.cuisine ?? '', r.category ?? '', ...r.tags, ...ingredientTerms]
    .join(' ')
    .toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export type RecipeSort = 'name' | 'time' | 'favorites' | 'recent';

export function sortRecipes(
  list: Recipe[],
  sort: RecipeSort,
  lastCooked: Map<string, number>,
): Recipe[] {
  const byName = (a: Recipe, b: Recipe) => a.name.localeCompare(b.name);
  const copy = [...list];
  switch (sort) {
    case 'time':
      return copy.sort((a, b) => totalMinutes(a) - totalMinutes(b) || byName(a, b));
    case 'favorites':
      return copy.sort((a, b) => Number(b.favorite) - Number(a.favorite) || byName(a, b));
    case 'recent':
      return copy.sort(
        (a, b) => (lastCooked.get(b.id) ?? 0) - (lastCooked.get(a.id) ?? 0) || byName(a, b),
      );
    default:
      return copy.sort(byName);
  }
}

/** Used by tests and the form: can this quantity/unit be compared at all? */
export const unitsCompatible = (from: string, to: string, density?: number): boolean =>
  convert(1, from, to, density) !== null;
