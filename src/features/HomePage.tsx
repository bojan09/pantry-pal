import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Search, Sparkles } from 'lucide-react';
import { db } from '@/data/db';
import { usePrefs } from '@/app/PrefsProvider';
import { Art, KitchenBackdrop, Sprig, StorageScene, type Zone } from '@/design/illustrations';
import { Card, Chip, cx, LinkButton } from '@/design/ui';
import { addDays, greetingFor, toISODate, weekDays } from '@/lib/dates';
import { RecipeCard, SampleBanner } from './RecipeCard';
import { SAMPLE_EXPIRING, SAMPLE_RECIPES, SAMPLE_STATS, SAMPLE_WEEK } from './sample';

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

const link =
  'whitespace-nowrap inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline-offset-4 hover:underline';

export function HomePage() {
  const { prefs } = usePrefs();
  const navigate = useNavigate();
  const [zone, setZone] = useState<Zone>('pantry');
  const [filter, setFilter] = useState(FILTERS[0]);
  const [q, setQ] = useState('');
  const now = new Date();
  const days = weekDays(now, prefs.weekStart);
  const today = toISODate(now);
  const sample = prefs.sampleContent;

  const lotCount = useLiveQuery(() => db.inventoryLots.count(), [], 0);
  const recipeCount = useLiveQuery(() => db.recipes.count(), [], 0);
  const stats = sample
    ? SAMPLE_STATS
    : { ingredients: lotCount, recipes: recipeCount, expiring: 0, lowStock: 0 };

  const hello = `Good ${greetingFor(now)}${prefs.name ? `, ${prefs.name}` : ''}!`;
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en', o).format(d);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="grid min-w-0 content-start gap-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl lg:border lg:border-line lg:shadow-card">
          <KitchenBackdrop className="absolute inset-0 hidden size-full lg:block" />
          <div className="absolute inset-0 hidden bg-gradient-to-r from-bg from-35% via-bg/85 via-52% to-transparent lg:block" />
          <div className="relative flex items-center gap-4 lg:min-h-[13rem] lg:px-8 lg:py-12">
            <div className="min-w-0">
              <h1 className="text-4xl font-semibold sm:text-5xl">{hello}</h1>
              <p className="mt-1 text-lg text-ink-soft">What delicious food shall we make today?</p>
            </div>
            <Sprig aria-hidden className="h-20 shrink-0 opacity-90 lg:hidden" />
          </div>
        </div>
        {sample && <SampleBanner />}

        {/* Mobile quick actions */}
        <div className="grid gap-4 lg:hidden">
          <LinkButton to="/recipes" className="min-h-14 text-base">
            <Sparkles aria-hidden className="size-5" /> Find recipes from my pantry
          </LinkButton>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              [stats.ingredients, 'Ingredients'],
              [stats.recipes, 'Recipes'],
              [stats.expiring, 'Expiring soon'],
            ].map(([n, l]) => (
              <div key={l} className="pp-card px-2 py-3">
                <dd className="font-display text-3xl font-semibold text-accent-text">{n}</dd>
                <dt className="text-xs text-ink-soft">{l}</dt>
              </div>
            ))}
          </dl>
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

        <Card aria-labelledby="storage-h" className="overflow-hidden">
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
          <div className="relative mt-4">
            <StorageScene zone={zone} filled={sample} className="w-full rounded-2xl" />
            <div className="mt-3 rounded-2xl bg-charcoal p-4 text-cream md:absolute md:right-4 md:top-4 md:mt-0 md:w-48">
              <p className="font-display text-xl font-semibold capitalize">{zone}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-1.5 [&>div]:flex-col [&>div]:items-start md:[&>div]:flex-row md:[&>div]:items-baseline">
                <div className="flex items-baseline gap-2">
                  <dd className="font-display text-2xl font-semibold">{stats.ingredients}</dd>
                  <dt className="text-xs text-cream/80">Ingredients</dt>
                </div>
                <div className="flex items-baseline gap-2">
                  <dd className="font-display text-2xl font-semibold text-saffron">
                    {stats.expiring}
                  </dd>
                  <dt className="text-xs text-cream/80">Expiring soon</dt>
                </div>
                <div className="flex items-baseline gap-2">
                  <dd className="font-display text-2xl font-semibold text-terracotta">
                    {stats.lowStock}
                  </dd>
                  <dt className="text-xs text-cream/80">Low stock</dt>
                </div>
              </dl>
              <Link
                to="/pantry"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-full bg-accent text-sm font-semibold text-accent-ink"
              >
                View Pantry <ChevronRight aria-hidden className="size-4" />
              </Link>
            </div>
          </div>
        </Card>

        <Card aria-labelledby="suggest-h">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="suggest-h" className="text-2xl font-semibold">
              Suggested for you
            </h2>
            <Link to="/recipes" className={link}>
              {sample ? 'Why these recipes?' : 'Browse recipes'}
            </Link>
          </div>
          {sample ? (
            <ul className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
              {SAMPLE_RECIPES.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <RecipeCard r={r} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-ink-soft">
              Suggestions appear here once you have recipes and ingredients logged. They are matched
              locally on this device.
            </p>
          )}
        </Card>
      </div>

      <div className="grid min-w-0 content-start gap-5">
        <Card aria-labelledby="exp-h">
          <div className="flex items-baseline justify-between">
            <h2 id="exp-h" className="text-xl font-semibold">
              Ingredients expiring soon
            </h2>
            <Link to="/expiring" className={link}>
              View all
            </Link>
          </div>
          {sample ? (
            <ul className="mt-2 divide-y divide-line">
              {SAMPLE_EXPIRING.map((e) => (
                <li key={e.name} className="flex min-h-12 items-center gap-3 py-1.5">
                  <Art name={e.art} className="size-9 shrink-0" />
                  <span className="flex-1 font-medium">{e.name}</span>
                  <span
                    className={cx(
                      'text-sm font-semibold',
                      e.days <= 2 ? 'text-bad' : e.days <= 3 ? 'text-warn' : 'text-ink-soft',
                    )}
                  >
                    {e.days} days
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-ink-soft">Nothing logged with a date yet.</p>
          )}
        </Card>

        <Card aria-labelledby="plan-h">
          <div className="flex items-baseline justify-between">
            <h2 id="plan-h" className="text-xl font-semibold">
              This week&apos;s meal plan
            </h2>
            <Link to="/planner" className={link}>
              View plan
            </Link>
          </div>
          <ol
            className="mt-3 grid grid-cols-7 gap-1 text-center text-xs"
            aria-label="Days this week"
          >
            {days.map((d, i) => {
              const iso = toISODate(d);
              const isToday = iso === today;
              const meal = sample ? SAMPLE_WEEK[i] : undefined;
              return (
                <li
                  key={iso}
                  className={cx(
                    'grid justify-items-center gap-1 rounded-xl py-2',
                    isToday && 'bg-accent text-accent-ink',
                  )}
                >
                  <span className="font-semibold">{fmt(d, { weekday: 'short' })}</span>
                  {meal ? (
                    <>
                      <Art name={meal.art} className="size-8" />
                      <span className="max-w-full truncate px-0.5 text-[11px]">{meal.label}</span>
                    </>
                  ) : (
                    <span className={cx('font-display text-lg', !isToday && 'text-ink-soft')}>
                      {d.getDate()}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {!sample && (
            <p className="mt-3 text-sm text-ink-soft">
              Nothing planned for {fmt(days[0], { month: 'short', day: 'numeric' })} –{' '}
              {fmt(addDays(days[0], 6), { month: 'short', day: 'numeric' })}.
            </p>
          )}
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
