import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search } from 'lucide-react';
import { db } from '@/data/db';
import { usePrefs } from '@/app/PrefsProvider';
import { StorageScene, Sprig, type Zone } from '@/design/illustrations';
import { Card, Chip, cx, LinkButton } from '@/design/ui';
import { addDays, greetingFor, toISODate, weekDays } from '@/lib/dates';

const ZONES: { id: Zone; label: string }[] = [
  { id: 'pantry', label: 'Pantry' },
  { id: 'fridge', label: 'Fridge' },
  { id: 'freezer', label: 'Freezer' },
];
const FILTERS = [
  'Use my ingredients',
  'Quick meals',
  'Vegetarian',
  'High protein',
  'Family meals',
  'Desserts',
];

export function HomePage() {
  const { prefs } = usePrefs();
  const navigate = useNavigate();
  const [zone, setZone] = useState<Zone>('pantry');
  const [filter, setFilter] = useState(FILTERS[0]);
  const [q, setQ] = useState('');
  const now = new Date();
  const days = weekDays(now, prefs.weekStart);
  const today = toISODate(now);

  const lotCount = useLiveQuery(() => db.inventoryLots.count(), [], 0);
  const recipeCount = useLiveQuery(() => db.recipes.count(), [], 0);

  const hello = `Good ${greetingFor(now)}${prefs.name ? `, ${prefs.name}` : ''}!`;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="grid min-w-0 content-start gap-5">
        <div>
          <h1 className="text-4xl font-semibold sm:text-5xl">{hello}</h1>
          <p className="mt-1 text-lg text-ink-soft">What delicious food shall we make today?</p>
        </div>

        <Card aria-labelledby="cook-h" className="relative overflow-hidden">
          <Sprig
            aria-hidden
            className="pointer-events-none absolute -right-2 -top-4 hidden h-36 opacity-70 sm:block"
          />
          <h2 id="cook-h" className="text-3xl font-semibold">
            Cook with what you have
          </h2>
          <p className="mt-1 text-ink-soft">Find recipes based on your ingredients.</p>
          <form
            role="search"
            className="relative mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/recipes${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
            }}
          >
            <Search
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft"
            />
            <input
              type="search"
              aria-label="What can I make today?"
              placeholder="What can I make today?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="min-h-12 w-full rounded-full border border-line bg-surface pl-12 pr-4 text-base placeholder:text-ink-soft/70"
            />
          </form>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Recipe filters">
            {FILTERS.map((f) => (
              <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
                {f}
              </Chip>
            ))}
          </div>
        </Card>

        <Card aria-labelledby="storage-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="storage-h" className="text-2xl font-semibold">
              Your storage
            </h2>
            <div
              role="tablist"
              aria-label="Storage zone"
              className="inline-flex gap-1 rounded-full bg-surface-2 p-1"
            >
              {ZONES.map((z) => (
                <button
                  key={z.id}
                  role="tab"
                  type="button"
                  aria-selected={zone === z.id}
                  onClick={() => setZone(z.id)}
                  className={cx(
                    'min-h-11 rounded-full px-4 text-sm font-semibold',
                    zone === z.id ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
            <StorageScene zone={zone} className="w-full rounded-2xl" />
            <div className="grid gap-3">
              <dl className="grid grid-cols-2 gap-3 text-center md:grid-cols-1">
                <div className="rounded-2xl bg-surface-2 p-3">
                  <dt className="text-sm text-ink-soft">Lots logged</dt>
                  <dd className="font-display text-3xl font-semibold">{lotCount}</dd>
                </div>
                <div className="rounded-2xl bg-surface-2 p-3">
                  <dt className="text-sm text-ink-soft">Recipes saved</dt>
                  <dd className="font-display text-3xl font-semibold">{recipeCount}</dd>
                </div>
              </dl>
              <LinkButton to="/pantry">View pantry</LinkButton>
            </div>
          </div>
        </Card>

        <Card aria-labelledby="suggest-h">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="suggest-h" className="text-2xl font-semibold">
              Suggested for you
            </h2>
            <Link
              to="/recipes"
              className="min-h-11 content-center text-sm font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              Browse recipes
            </Link>
          </div>
          <p className="mt-2 text-ink-soft">
            Suggestions appear here once you have recipes and ingredients logged. They are matched
            locally on this device.
          </p>
        </Card>
      </div>

      <div className="grid min-w-0 content-start gap-5">
        <Card aria-labelledby="exp-h">
          <h2 id="exp-h" className="text-xl font-semibold">
            Ingredients expiring soon
          </h2>
          <p className="mt-2 text-ink-soft">Nothing logged with a date yet.</p>
          <Link
            to="/expiring"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </Card>

        <Card aria-labelledby="plan-h">
          <div className="flex items-baseline justify-between">
            <h2 id="plan-h" className="text-xl font-semibold">
              This week&apos;s meal plan
            </h2>
            <Link
              to="/planner"
              className="min-h-11 content-center text-sm font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              View plan
            </Link>
          </div>
          <ol
            className="mt-3 grid grid-cols-7 gap-1 text-center text-xs"
            aria-label="Days this week"
          >
            {days.map((d) => {
              const iso = toISODate(d);
              const isToday = iso === today;
              return (
                <li
                  key={iso}
                  className={cx(
                    'grid gap-1 rounded-xl py-2',
                    isToday && 'bg-accent text-accent-ink',
                  )}
                >
                  <span className="font-semibold">
                    {new Intl.DateTimeFormat('en', { weekday: 'short' }).format(d)}
                  </span>
                  <span className={cx('font-display text-lg', !isToday && 'text-ink-soft')}>
                    {d.getDate()}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-sm text-ink-soft">
            Nothing planned for{' '}
            {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(days[0])} –{' '}
            {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
              addDays(days[0], 6),
            )}
            .
          </p>
        </Card>

        <Card className="relative overflow-hidden bg-surface-2">
          <p className="relative z-10 max-w-[12rem] font-display text-3xl font-semibold leading-tight">
            Good food is a happier home.
          </p>
          <Sprig aria-hidden className="absolute -right-2 bottom-0 h-32 opacity-60" />
        </Card>
      </div>
    </div>
  );
}
