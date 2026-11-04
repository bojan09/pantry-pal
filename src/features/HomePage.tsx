import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { backupDue, snoozeBackupReminder } from '@/app/backupMeta';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Search, Sparkles } from 'lucide-react';
import { db } from '@/data/db';
import { usePrefs } from '@/app/PrefsProvider';
import { Art, KitchenBackdrop, Sprig, type ArtKey, type Zone } from '@/design/illustrations';
import { colorFor, ItemSprite } from '@/design/illustrations/sprites';
import { spriteKindFor } from '@/data/catalog';
import { byFirstExpiring, daysUntil, expiryStatus } from '@/domain/lots';
import { LivingPantry } from './pantry/LivingPantry';
import { usePantryData } from './pantry/hooks';
import { Button, Card, Chip, cx, LinkButton } from '@/design/ui';
import { addDays, greetingFor, toISODate, weekDays } from '@/lib/dates';
import { RecipeCard } from './recipes/RecipeCard';
import { useRecipeLibrary } from './recipes/hooks';

const ZONES: { id: Zone; label: string }[] = [
  { id: 'pantry', label: 'Pantry' },
  { id: 'fridge', label: 'Fridge' },
  { id: 'freezer', label: 'Freezer' },
];
const FILTERS: { label: string; to: string }[] = [
  { label: 'Use my ingredients', to: '/recipes?ready=1' },
  { label: 'Quick meals', to: '/recipes?q=quick' },
  { label: 'Vegetarian', to: '/recipes?q=vegetarian' },
  { label: 'High protein', to: '/recipes?q=high-protein' },
  { label: 'Family meals', to: '/recipes?q=family' },
  { label: 'Desserts', to: '/recipes?q=dessert' },
];

const link =
  'whitespace-nowrap inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline-offset-4 hover:underline';

export function HomePage() {
  const { prefs } = usePrefs();
  const navigate = useNavigate();
  const [zone, setZone] = useState<Zone>('pantry');
  const [q, setQ] = useState('');
  const now = new Date();
  const days = weekDays(now, prefs.weekStart);
  const today = toISODate(now);
  const weekPlan = useLiveQuery(async () => {
    const first = toISODate(days[0]);
    const last = toISODate(days[6]);
    const [entries, recipes] = await Promise.all([
      db.mealPlans.where('date').between(first, last, true, true).toArray(),
      db.recipes.toArray(),
    ]);
    return { entries, recipes: new Map(recipes.map((r) => [r.id, r])) };
  }, [toISODate(days[0])]);

  const pantry = usePantryData();
  const recipeCount = useLiveQuery(() => db.recipes.count(), [], 0);
  const [hideBackup, setHideBackup] = useState(false);
  const myRecipes = useLiveQuery(() => db.recipes.filter((r) => !r.isStarter).count(), [], 0);
  const showBackup =
    !hideBackup && backupDue((pantry?.lots.length ?? 0) + myRecipes > 0, new Date().getTime());
  const library = useRecipeLibrary();
  const hasStock = (pantry?.lots.length ?? 0) > 0;
  const suggested = (library?.recipes ?? [])
    .map((r) => ({ r, m: library!.matches.get(r.id) }))
    .filter((x) => !(prefs.allergens.length && x.m?.allergens.length))
    .sort((x, y) =>
      hasStock
        ? (y.m?.score ?? 0) - (x.m?.score ?? 0) || x.r.name.localeCompare(y.r.name)
        : x.r.prepMinutes + x.r.cookMinutes - (y.r.prepMinutes + y.r.cookMinutes) ||
          x.r.name.localeCompare(y.r.name),
    )
    .slice(0, 4);
  const zoneItems = pantry?.byZone(zone) ?? [];
  const zoneStats = {
    ingredients: zoneItems.length,
    expiring: zoneItems.filter((s) => s.status === 'soon' || s.status === 'expired').length,
    lowStock: zoneItems.filter((s) => s.low).length,
  };
  const totalIngredients = pantry?.all.length ?? 0;
  const totalExpiring =
    pantry?.all.filter((s) => s.status === 'soon' || s.status === 'expired').length ?? 0;
  const expiringLots = (pantry?.lots ?? [])
    .filter((l) => ['soon', 'expired'].includes(expiryStatus(l, pantry!.today, pantry!.leadDays)))
    .sort(byFirstExpiring)
    .slice(0, 5);
  const ingById = new Map((pantry?.ingredients ?? []).map((i) => [i.id, i]));

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

        {showBackup && (
          <Card
            aria-labelledby="bk-h"
            className="flex flex-wrap items-center justify-between gap-3 bg-warn-soft"
          >
            <div>
              <h2 id="bk-h" className="text-lg font-semibold">
                Back up your kitchen
              </h2>
              <p className="text-sm text-ink-soft">
                Your data lives only in this browser, which can clear it. A backup is one file.
              </p>
            </div>
            <div className="flex gap-2">
              <LinkButton to="/settings#backup">Back up now</LinkButton>
              <Button
                variant="ghost"
                onClick={() => {
                  snoozeBackupReminder(7);
                  setHideBackup(true);
                }}
              >
                Remind me in a week
              </Button>
            </div>
          </Card>
        )}

        {/* Mobile quick actions */}
        <div className="grid gap-4 lg:hidden">
          <LinkButton to="/recipes" className="min-h-14 text-base">
            <Sparkles aria-hidden className="size-5" /> Find recipes from my pantry
          </LinkButton>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              [totalIngredients, 'Ingredients'],
              [recipeCount, 'Recipes'],
              [totalExpiring, 'Dates to check'],
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
              <Chip key={f.label} onClick={() => navigate(f.to)}>
                {f.label}
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
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
            <LivingPantry
              zone={zone}
              items={zoneItems}
              system={prefs.units}
              today={pantry?.today ?? ''}
              leadDays={prefs.expiryLeadDays}
              onSelect={(id) => navigate(`/pantry/${id}`)}
              onOverflow={() => navigate('/pantry')}
            />
            <div className="rounded-2xl bg-charcoal p-4 text-cream md:self-start">
              <p className="font-display text-xl font-semibold capitalize">{zone}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-1.5 [&>div]:flex-col [&>div]:items-start md:[&>div]:flex-row md:[&>div]:items-baseline">
                <div className="flex items-baseline gap-2">
                  <dd className="font-display text-2xl font-semibold">{zoneStats.ingredients}</dd>
                  <dt className="text-xs text-cream/80">Ingredients</dt>
                </div>
                <div className="flex items-baseline gap-2">
                  <dd className="font-display text-2xl font-semibold text-saffron">
                    {zoneStats.expiring}
                  </dd>
                  <dt className="text-xs text-cream/80">Dates to check</dt>
                </div>
                <div className="flex items-baseline gap-2">
                  <dd className="font-display text-2xl font-semibold text-terracotta">
                    {zoneStats.lowStock}
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
              {hasStock ? 'Suggested for you' : 'Quick starters'}
            </h2>
            <Link to="/recipes" className={link}>
              Browse recipes
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {hasStock
              ? 'Ranked by pantry coverage, ingredients with a date coming up, speed and variety. Open a recipe to see why.'
              : 'Add ingredients to your pantry and these will be ranked by what you already have.'}
          </p>
          {suggested.length > 0 && (
            <ul className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
              {suggested.map(({ r, m }) => (
                <li key={r.id}>
                  <RecipeCard recipe={r} match={hasStock ? m : undefined} />
                </li>
              ))}
            </ul>
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
          {expiringLots.length ? (
            <ul className="mt-2 divide-y divide-line">
              {expiringLots.map((l) => {
                const ing = ingById.get(l.ingredientId);
                if (!ing || !l.date) return null;
                const d = daysUntil(l.date, pantry!.today);
                return (
                  <li key={l.id}>
                    <Link
                      to={`/pantry/${ing.id}`}
                      className="flex min-h-12 items-center gap-3 py-1.5"
                    >
                      <ItemSprite
                        name={ing.name}
                        kind={spriteKindFor(ing)}
                        color={colorFor(ing.name, ing.id)}
                        className="h-9 shrink-0"
                      />
                      <span className="flex-1 font-medium">{ing.name}</span>
                      <span
                        className={cx(
                          'text-sm font-semibold',
                          d < 0 ? 'text-bad' : d <= 2 ? 'text-bad' : 'text-warn',
                        )}
                      >
                        {d < 0
                          ? 'Past date'
                          : d === 0
                            ? 'Today'
                            : `${d} ${d === 1 ? 'day' : 'days'}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-ink-soft">
              {pantry?.lots.length
                ? `Nothing with a date in the next ${prefs.expiryLeadDays} days.`
                : 'Nothing logged yet.'}
            </p>
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
            {days.map((d) => {
              const iso = toISODate(d);
              const isToday = iso === today;
              const dayEntries = (weekPlan?.entries ?? [])
                .filter((e) => e.date === iso)
                .sort((a, b) => a.position - b.position);
              const firstE = dayEntries[0];
              const r = firstE?.recipeId ? weekPlan?.recipes.get(firstE.recipeId) : undefined;
              const meal = firstE
                ? {
                    label: r?.name ?? firstE.label ?? 'Meal',
                    art: r?.art as ArtKey | undefined,
                    more: dayEntries.length - 1,
                  }
                : undefined;
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
                      {meal.art && <Art name={meal.art} className="size-8" />}
                      <span className="max-w-full truncate px-0.5 text-[11px]">{meal.label}</span>
                      {meal.more > 0 && <span className="text-[10px]">+{meal.more} more</span>}
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
          {!weekPlan?.entries.length && (
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
