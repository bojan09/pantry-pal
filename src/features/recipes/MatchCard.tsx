import { Card } from '@/design/ui';
import { tierLabel, type Match } from '@/domain/matching';
import { TierBadge } from './RecipeCard';

/** Shows exactly where a recipe's match score comes from. No hidden factors. */
export function MatchCard({ match, servings }: { match: Match; servings: number }) {
  return (
    <Card aria-labelledby="match-h" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="match-h" className="text-2xl font-semibold">
          Why this match
        </h2>
        <TierBadge match={match} />
      </div>
      <p className="text-sm text-ink-soft">
        Score {match.score} of 100, worked out on this device for the recipe&apos;s own {servings}{' '}
        {servings === 1 ? 'serving' : 'servings'}. It only decides the order recipes are shown in.
      </p>
      <ul className="grid gap-2" aria-label="Score breakdown">
        {match.parts.map((p) => (
          <li key={p.key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{p.label}</span>
              <span className="tabular-nums text-ink-soft">
                {p.points} / {p.max}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(p.points / p.max) * 100}%` }}
              />
            </div>
            <p className="text-sm text-ink-soft">{p.note}</p>
          </li>
        ))}
      </ul>
      {match.missing.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">{tierLabel(match.tier, match.missing.length)}</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">
            {match.missing.map((m) => (
              <li key={m.ingredientId}>
                {m.name}: {m.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {match.skippedPastDate && (
        <p className="rounded-2xl bg-warn-soft px-3 py-2 text-sm text-warn">
          Some stock past its use-by date was not counted. Check the date on the package yourself.
        </p>
      )}
      {match.allergens.length > 0 && (
        <p className="rounded-2xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
          Contains {match.allergens.join(', ')}, which you listed in Settings. This comes only from
          the ingredient data in the app.
        </p>
      )}
      {match.diets.length > 0 && (
        <p className="text-sm text-ink-soft">
          Tagged: {match.diets.join(', ')} (from the recipe&apos;s tags).
        </p>
      )}
      <p className="text-xs text-ink-soft">
        Dates and tags are what you entered. They are not medical or food-safety advice, and a
        recipe being a good match does not mean its ingredients are safe to eat.
      </p>
    </Card>
  );
}
