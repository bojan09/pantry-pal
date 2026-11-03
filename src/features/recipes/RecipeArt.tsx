import { Art, type ArtKey } from '@/design/illustrations';
import { useMediaUrl } from '@/app/useMediaUrl';
import type { Recipe } from '@/data/types';
import { cx } from '@/design/ui';

/** The recipe's own photo when it has one, otherwise its bundled illustration. */
export function RecipeArt({
  recipe,
  className,
  artClassName = 'h-[88%] drop-shadow-md',
}: {
  recipe: Pick<Recipe, 'name' | 'imageId' | 'art'>;
  className?: string;
  artClassName?: string;
}) {
  const url = useMediaUrl(recipe.imageId);
  return (
    <div
      className={cx(
        'relative grid place-items-center overflow-hidden bg-gradient-to-br from-oat to-surface-2',
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt={recipe.name}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <Art name={(recipe.art as ArtKey) ?? 'bowl'} className={artClassName} />
      )}
    </div>
  );
}
