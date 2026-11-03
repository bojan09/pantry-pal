import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { cx } from '@/design/ui';
import { addDays, fromISODate, startOfWeek, toISODate, type WeekStart } from '@/lib/dates';

/** Calendar of the whole month. Choosing a day opens that day's week for editing. */
export function MonthView({
  anchor,
  weekStart,
  today,
  onPick,
}: {
  anchor: Date;
  weekStart: WeekStart;
  today: string;
  onPick: (iso: string) => void;
}) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart, weekStart);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const weeks = Math.ceil(
    ((+startOfWeekEnd(monthEnd, weekStart) - +gridStart) / 86_400_000 + 1) / 7,
  );
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const first = toISODate(days[0]);
  const last = toISODate(days[days.length - 1]);

  const data = useLiveQuery(async () => {
    const [entries, recipes] = await Promise.all([
      db.mealPlans.where('date').between(first, last, true, true).toArray(),
      db.recipes.toArray(),
    ]);
    return { entries, names: new Map(recipes.map((r) => [r.id, r.name])) };
  }, [first, last]);

  const head = days
    .slice(0, 7)
    .map((d) => new Intl.DateTimeFormat('en', { weekday: 'short' }).format(d));
  return (
    <div
      role="grid"
      aria-label={new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(anchor)}
      className="pp-card overflow-hidden p-2"
    >
      <div
        role="row"
        className="grid grid-cols-7 text-center text-xs font-bold uppercase tracking-wide text-ink-soft"
      >
        {head.map((h) => (
          <div key={h} role="columnheader" className="py-2">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const list = (data?.entries ?? []).filter((e) => e.date === iso);
          const names = list.map(
            (e) => (e.recipeId ? data?.names.get(e.recipeId) : undefined) ?? e.label ?? 'Meal',
          );
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              onClick={() => onPick(iso)}
              aria-label={`${new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)}: ${list.length ? `${list.length} planned: ${names.join(', ')}` : 'nothing planned'}`}
              className={cx(
                'pp-lift grid min-h-20 content-start gap-0.5 rounded-xl border p-1.5 text-left text-xs',
                inMonth
                  ? 'border-line bg-surface'
                  : 'border-transparent bg-surface-2 text-ink-soft',
                iso === today && 'ring-2 ring-accent',
              )}
            >
              <span className="font-display text-base font-semibold">{d.getDate()}</span>
              {names.slice(0, 2).map((n, i) => (
                <span key={i} className="truncate rounded bg-accent-soft px-1 text-accent-text">
                  {n}
                </span>
              ))}
              {names.length > 2 && <span className="text-ink-soft">+{names.length - 2} more</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function startOfWeekEnd(d: Date, weekStart: WeekStart): Date {
  return addDays(startOfWeek(d, weekStart), 6);
}

export { fromISODate };
