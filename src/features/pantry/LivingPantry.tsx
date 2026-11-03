import { AnimatePresence, motion } from 'motion/react';
import { StorageScene, type Zone } from '@/design/illustrations/scenes';
import { colorFor, ItemSprite } from '@/design/illustrations/sprites';
import { spriteKindFor } from '@/data/catalog';
import { statusText, type IngredientSummary } from '@/domain/lots';
import { formatTotals } from './format';

const PER_ROW = 8;
const ROWS = [
  { bottom: 63.5 }, // shelf lines in the 400x230 cabinet drawing, as % from the bottom
  { bottom: 37.4 },
  { bottom: 12.2 },
];
export const SCENE_CAPACITY = PER_ROW * ROWS.length;

const DOT: Record<string, string> = { expired: 'bg-bad', soon: 'bg-warn' };

/**
 * Interactive cabinet drawn from LOGGED stock only: one item per ingredient in the zone.
 * It is a visualisation of manual records, not a sensor reading. The list view is the
 * full-size, fully accessible alternative.
 */
export function LivingPantry({
  zone,
  items,
  system,
  today,
  leadDays,
  onSelect,
  onOverflow,
  className,
}: {
  zone: Zone;
  items: IngredientSummary[];
  system: 'metric' | 'imperial';
  today: string;
  leadDays: number;
  onSelect: (ingredientId: string) => void;
  onOverflow?: () => void;
  className?: string;
}) {
  const sorted = [...items].sort(
    (a, b) =>
      a.ingredient.category.localeCompare(b.ingredient.category) ||
      a.ingredient.name.localeCompare(b.ingredient.name),
  );
  const shown = sorted.slice(0, SCENE_CAPACITY);
  const extra = sorted.length - shown.length;

  return (
    <div className={className}>
      <motion.div
        key={zone}
        initial={{ opacity: 0, rotateY: -18 }}
        animate={{ opacity: 1, rotateY: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        style={{ transformOrigin: 'left center', transformPerspective: 900 }}
        className="relative"
      >
        <StorageScene zone={zone} className="w-full rounded-2xl" />
        <ul aria-label={`${zone} shelves`} className="absolute inset-0 m-0 list-none p-0">
          {ROWS.map((row, r) => (
            <li
              key={r}
              className="absolute left-[6%] right-[6%] m-0 flex items-end gap-[0.6%]"
              style={{ bottom: `${row.bottom}%`, height: '21%' }}
            >
              <AnimatePresence initial={false}>
                {shown.slice(r * PER_ROW, (r + 1) * PER_ROW).map((s) => {
                  const name = s.ingredient.name;
                  const label = `${name}, ${formatTotals(s.totals, system)}${s.low ? ', low stock' : ''}. ${s.nextLot ? statusText(s.nextLot, today, leadDays) : ''}`;
                  return (
                    <motion.button
                      key={s.ingredient.id}
                      type="button"
                      layout
                      initial={{ opacity: 0, y: -24, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16, scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                      whileHover={{ y: -6 }}
                      onClick={() => onSelect(s.ingredient.id)}
                      aria-label={label}
                      title={`${name} · ${formatTotals(s.totals, system)}`}
                      className="relative h-full shrink-0 rounded-md [transition:none]"
                      style={{ aspectRatio: '3 / 4' }}
                    >
                      <ItemSprite
                        name={name}
                        kind={spriteKindFor(s.ingredient)}
                        color={colorFor(name, s.ingredient.id)}
                        className="size-full"
                      />
                      {(s.status === 'expired' || s.status === 'soon') && (
                        <span
                          aria-hidden
                          className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-white ${DOT[s.status]}`}
                        />
                      )}
                      {s.low && (
                        <span
                          aria-hidden
                          className="absolute -left-0.5 -top-0.5 size-2.5 rounded-full bg-saffron ring-2 ring-white"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </li>
          ))}
        </ul>
        {shown.length === 0 && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm font-medium text-ink-soft">
            Empty shelves. Add an ingredient to fill them.
          </p>
        )}
      </motion.div>
      {extra > 0 && (
        <button
          type="button"
          onClick={onOverflow}
          className="mt-2 min-h-11 rounded-full bg-surface-2 px-4 text-sm font-semibold"
        >
          +{extra} more in the list view
        </button>
      )}
      <p className="mt-2 text-xs text-ink-soft">
        Drawn from the stock you logged. A red dot marks a date that has passed or is near; a yellow
        dot marks low stock.
      </p>
    </div>
  );
}
