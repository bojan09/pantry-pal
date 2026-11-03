import type { Ingredient, InventoryLot, Recipe, RecipeIngredient } from '@/data/types';
import { expiryStatus } from './lots';
import { totalMinutes, type RecipeAvailability } from './recipes';

export type Tier = 'ready' | 'nearly' | 'missing';

export interface ScorePart {
  key: 'coverage' | 'useSoon' | 'time' | 'favorite' | 'variety';
  label: string;
  points: number;
  max: number;
  note: string;
}

export interface Match {
  /** 0-100. Only for ordering; it is not a quality or safety rating. */
  score: number;
  tier: Tier;
  parts: ScorePart[];
  /** required lines the pantry does not fully cover */
  missing: { ingredientId: string; name: string; text: string }[];
  /** ingredients the recipe uses that have a date coming up within the alert window */
  useSoon: string[];
  /** allergens the user listed that appear in this recipe's ingredient data */
  allergens: string[];
  /** diets the user listed that are in the recipe's tags */
  diets: string[];
  /** some stock was left out because its use-by date has passed */
  skippedPastDate: boolean;
}

export interface MatchContext {
  today: string;
  leadDays: number;
  diets: string[];
  allergens: string[];
  /** when the recipe was last cooked (ms), if ever */
  lastCooked?: number;
  now: number;
}

const DAY = 86_400_000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Explainable, deterministic ranking. Every point has a plain-language reason, so a user can
 * see exactly why a recipe sits where it does. There is no hidden model.
 *   coverage 55 · use-soon 20 · time 10 · variety 10 · favourite 5
 */
export function matchRecipe(
  recipe: Recipe,
  lines: RecipeIngredient[],
  avail: RecipeAvailability,
  usableByIngredient: Map<string, InventoryLot[]>,
  ingredients: Map<string, Ingredient>,
  allLotsByIngredient: Map<string, InventoryLot[]>,
  ctx: MatchContext,
): Match {
  const required = avail.lines.filter((l) => !l.line.optional);
  const nameOf = (id: string) => ingredients.get(id)?.name ?? 'Ingredient';

  // coverage: full credit for enough, proportional credit for a partial amount
  let credit = 0;
  const missing: Match['missing'] = [];
  for (const l of required) {
    if (l.status === 'enough') credit += 1;
    else {
      if (l.status === 'short' && l.available != null && l.needed > 0)
        credit += Math.min(0.9, l.available / l.needed);
      missing.push({
        ingredientId: l.line.ingredientId,
        name: nameOf(l.line.ingredientId),
        text:
          l.status === 'short'
            ? 'not enough'
            : l.status === 'unit'
              ? 'tracked in a unit that cannot be compared'
              : 'not in your pantry',
      });
    }
  }
  const coverageFrac = required.length ? credit / required.length : 1;
  const coverage = Math.round(coverageFrac * 55 * 10) / 10;

  // use-soon: the recipe uses stock whose date is coming up (never past-date stock)
  const useSoon = [
    ...new Set(
      lines
        .filter((l) =>
          (usableByIngredient.get(l.ingredientId) ?? []).some(
            (lot) => expiryStatus(lot, ctx.today, ctx.leadDays) === 'soon',
          ),
        )
        .map((l) => nameOf(l.ingredientId)),
    ),
  ];
  const useSoonPts =
    coverageFrac >= 0.5 ? Math.round(20 * Math.min(1, useSoon.length / 2) * 10) / 10 : 0;

  const mins = totalMinutes(recipe);
  const timePts = mins <= 15 ? 10 : mins <= 30 ? 8 : mins <= 45 ? 5 : mins <= 60 ? 3 : 1;

  const since = ctx.lastCooked ? (ctx.now - ctx.lastCooked) / DAY : Infinity;
  const varietyPts = since < 3 ? 0 : since < 14 ? 5 : 10;

  const favPts = recipe.favorite ? 5 : 0;

  const parts: ScorePart[] = [
    {
      key: 'coverage',
      label: 'Pantry coverage',
      points: coverage,
      max: 55,
      note: required.length
        ? `${avail.have} of ${required.length} required ingredients fully covered`
        : 'No required ingredients',
    },
    {
      key: 'useSoon',
      label: 'Uses ingredients with a date coming up',
      points: useSoonPts,
      max: 20,
      note: useSoon.length
        ? `${useSoon.join(', ')} ${useSoon.length === 1 ? 'has' : 'have'} a date within ${ctx.leadDays} days`
        : 'Nothing it uses has a date coming up',
    },
    {
      key: 'time',
      label: 'Quick to make',
      points: timePts,
      max: 10,
      note: `${mins} minutes in total`,
    },
    {
      key: 'variety',
      label: 'Variety',
      points: varietyPts,
      max: 10,
      note: ctx.lastCooked
        ? `Last cooked ${Math.max(0, Math.floor(since))} ${Math.floor(since) === 1 ? 'day' : 'days'} ago`
        : 'Not cooked yet',
    },
    {
      key: 'favorite',
      label: 'Favourite',
      points: favPts,
      max: 5,
      note: recipe.favorite ? 'You starred it' : 'Not a favourite',
    },
  ];
  const score = Math.round(parts.reduce((s, p) => s + p.points, 0));

  const tier: Tier = avail.ready
    ? 'ready'
    : missing.length <= 2 && coverageFrac >= 0.6
      ? 'nearly'
      : 'missing';

  const want = new Set(ctx.allergens.map((a) => a.toLowerCase()));
  const allergens = [
    ...new Set(
      lines.flatMap((l) =>
        (ingredients.get(l.ingredientId)?.allergens ?? []).filter((a) => want.has(a.toLowerCase())),
      ),
    ),
  ].sort();
  const tags = new Set(recipe.tags.map((t) => t.toLowerCase()));
  const diets = ctx.diets.filter((d) => tags.has(d.toLowerCase()));

  const skippedPastDate = lines.some(
    (l) =>
      (allLotsByIngredient.get(l.ingredientId)?.length ?? 0) >
      (usableByIngredient.get(l.ingredientId)?.length ?? 0),
  );

  return {
    score: clamp(score, 0, 100),
    tier,
    parts,
    missing,
    useSoon,
    allergens,
    diets,
    skippedPastDate,
  };
}

export const tierLabel = (t: Tier, missing: number): string =>
  t === 'ready'
    ? 'Ready to cook'
    : t === 'nearly'
      ? `Nearly ready · ${missing} to get`
      : `${missing} ${missing === 1 ? 'ingredient' : 'ingredients'} missing`;
