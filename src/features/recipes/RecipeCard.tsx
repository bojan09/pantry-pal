import { Link } from 'react-router-dom';
import { errorMessage } from '@/data/errors';
import { Heart, Clock, Zap } from 'lucide-react';
import { recipes as repo } from '@/data/recipes';
import type { Recipe } from '@/data/types';
import { totalMinutes } from '@/domain/recipes';
import { tierLabel, type Match } from '@/domain/matching';
import { useToast } from '@/app/Toast';
import { RecipeArt } from './RecipeArt';

export function FavoriteButton({
  recipe,
  className = '',
}: {
  recipe: Pick<Recipe, 'id' | 'name' | 'favorite'>;
  className?: string;
}) {
  const toast = useToast();
  return (
    <button
      type="button"
      aria-pressed={recipe.favorite}
      aria-label={
        recipe.favorite
          ? `Remove ${recipe.name} from favourites`
          : `Add ${recipe.name} to favourites`
      }
      onClick={() =>
        repo
          .setFavorite(recipe.id, !recipe.favorite)
          .catch((e: unknown) =>
            toast({ message: errorMessage(e, 'Could not update'), tone: 'error' }),
          )
      }
      className={`pp-lift grid size-11 place-items-center rounded-full bg-surface/90 text-accent-text shadow ${className}`}
    >
      <Heart aria-hidden className={`size-5 ${recipe.favorite ? 'fill-current' : ''}`} />
    </button>
  );
}

export function TierBadge({ match }: { match: Match }) {
  const cls =
    match.tier === 'ready'
      ? 'bg-good-soft text-good'
      : match.tier === 'nearly'
        ? 'bg-warn-soft text-warn'
        : 'bg-surface-2 text-ink-soft';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}
    >
      <Zap aria-hidden className="size-3.5" />
      {tierLabel(match.tier, match.missing.length)}
    </span>
  );
}

export function RecipeCard({ recipe, match }: { recipe: Recipe; match?: Match }) {
  const mins = totalMinutes(recipe);
  return (
    <div className="pp-card group relative grid overflow-hidden p-0 pp-lift">
      <Link to={`/recipes/${recipe.id}`} className="grid gap-3">
        <RecipeArt recipe={recipe} className="aspect-[4/3]" />
        <div className="grid gap-1 px-4 pb-4">
          <h3 className="font-display text-lg font-semibold leading-tight">{recipe.name}</h3>
          <p className="flex items-center gap-1.5 text-sm text-ink-soft">
            <Clock aria-hidden className="size-3.5" />
            {mins > 0 ? `${mins} min` : 'No cooking'} · {recipe.difficulty}
            {recipe.cuisine ? ` · ${recipe.cuisine}` : ''}
          </p>
          {match && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              <TierBadge match={match} />
              {match.allergens.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-bad-soft px-3 py-1 text-xs font-semibold text-bad">
                  Contains {match.allergens.join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
      <FavoriteButton recipe={recipe} className="absolute right-2 top-2" />
    </div>
  );
}
