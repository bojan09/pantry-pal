import { Link } from 'react-router-dom';
import { Heart, Clock } from 'lucide-react';
import { recipes as repo } from '@/data/recipes';
import type { Recipe } from '@/data/types';
import { totalMinutes, type RecipeAvailability } from '@/domain/recipes';
import { useToast } from '@/app/Toast';
import { MatchPill } from '../RecipeCard';
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
            toast({ message: e instanceof Error ? e.message : 'Could not update', tone: 'error' }),
          )
      }
      className={`pp-lift grid size-11 place-items-center rounded-full bg-surface/90 text-accent-text shadow ${className}`}
    >
      <Heart aria-hidden className={`size-5 ${recipe.favorite ? 'fill-current' : ''}`} />
    </button>
  );
}

export function RecipeCard({
  recipe,
  availability,
}: {
  recipe: Recipe;
  availability?: RecipeAvailability;
}) {
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
          {availability && availability.total > 0 && (
            <div className="mt-1">
              <MatchPill have={availability.have} total={availability.total} />
            </div>
          )}
        </div>
      </Link>
      <FavoriteButton recipe={recipe} className="absolute right-2 top-2" />
    </div>
  );
}
