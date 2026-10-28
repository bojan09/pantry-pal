import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarDays, Clock, Layers, ShoppingCart } from 'lucide-react';
import { Art, Basket, Sprig, StorageScene, Tomato, type Zone } from '@/design/illustrations';
import { Card, cx, EmptyState, LinkButton, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { RecipeCard, SampleBanner } from './RecipeCard';
import { SAMPLE_RECIPES, SAMPLE_WEEK } from './sample';
import { MORE_ITEMS } from '@/app/nav';
import { toISODate, weekDays } from '@/lib/dates';

export function PantryPage() {
  const { prefs } = usePrefs();
  const [zone, setZone] = useState<Zone>('pantry');
  return (
    <>
      <PageHeader title="My Pantry" subtitle="Everything you have, by shelf." />
      {prefs.sampleContent && (
        <div className="mb-4">
          <SampleBanner />
        </div>
      )}
      <Card>
        <div
          role="tablist"
          aria-label="Storage zone"
          className="mb-4 inline-flex gap-1 rounded-full bg-surface-2 p-1"
        >
          {(['pantry', 'fridge', 'freezer'] as const).map((z) => (
            <button
              key={z}
              role="tab"
              type="button"
              aria-selected={zone === z}
              onClick={() => setZone(z)}
              className={cx(
                'min-h-11 rounded-full px-4 text-sm font-semibold capitalize',
                zone === z ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:text-ink',
              )}
            >
              {z}
            </button>
          ))}
        </div>
        <StorageScene zone={zone} filled={prefs.sampleContent} className="w-full rounded-2xl" />
        {!prefs.sampleContent && (
          <EmptyState
            art={<Basket />}
            title="Your pantry is empty"
            body="Nothing is logged yet. Adding ingredients, quantities and dates arrives in the next release."
          />
        )}
      </Card>
    </>
  );
}

export function RecipesPage() {
  const { prefs } = usePrefs();
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const list = prefs.sampleContent
    ? SAMPLE_RECIPES.filter((r) => r.name.toLowerCase().includes(q))
    : [];
  return (
    <>
      <PageHeader title="Recipes" subtitle="Your cookbook, searchable offline." />
      {prefs.sampleContent ? (
        <div className="grid gap-4">
          <SampleBanner />
          {list.length ? (
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {list.map((r) => (
                <li key={r.id}>
                  <RecipeCard r={r} />
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <p className="text-ink-soft">No sample recipes match &ldquo;{q}&rdquo;.</p>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <EmptyState
            art={<BookOpen aria-hidden className="size-full text-accent-bright" />}
            title="No recipes yet"
            body="The starter cookbook and your own recipes will live here once the recipe library is built."
          />
        </Card>
      )}
    </>
  );
}

export function RecipeDetailPage() {
  const { id } = useParams();
  const { prefs } = usePrefs();
  const r = prefs.sampleContent ? SAMPLE_RECIPES.find((x) => x.id === id) : undefined;
  if (r) {
    return (
      <>
        <PageHeader
          title={r.name}
          subtitle={`${r.minutes} min · ${r.difficulty}`}
          back="/recipes"
        />
        <Card>
          <SampleBanner />
          <div className="mt-4 grid place-items-center rounded-2xl bg-gradient-to-br from-oat to-surface-2 py-6">
            <Art name={r.art} className="h-56" />
          </div>
          <p className="mt-4 text-ink-soft">
            Full recipes with ingredients, steps, scaling and Cooking Mode arrive in a later
            release. This is a sample card only.
          </p>
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Recipe" back="/recipes" />
      <Card>
        <EmptyState
          art={<Tomato />}
          title="Recipe not found"
          body={`There is no recipe with id "${id ?? ''}" on this device.`}
          action={<LinkButton to="/recipes">Back to recipes</LinkButton>}
        />
      </Card>
    </>
  );
}

export function PlannerPage() {
  const { prefs } = usePrefs();
  const days = weekDays(new Date(), prefs.weekStart);
  return (
    <>
      <PageHeader title="Meal Planner" subtitle="Plan breakfast, lunch, dinner and snacks." />
      {prefs.sampleContent ? (
        <div className="grid gap-4">
          <SampleBanner />
          <Card>
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {days.map((d, i) => (
                <li
                  key={toISODate(d)}
                  className="grid justify-items-center gap-2 rounded-2xl bg-surface-2 p-3 text-center"
                >
                  <span className="text-sm font-semibold">
                    {new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric' }).format(d)}
                  </span>
                  <Art name={SAMPLE_WEEK[i].art} className="size-16" />
                  <span className="text-sm">{SAMPLE_WEEK[i].label}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState
            art={<CalendarDays aria-hidden className="size-full text-accent-bright" />}
            title="Nothing planned"
            body="Scheduling recipes into your week arrives in a later release."
          />
        </Card>
      )}
    </>
  );
}

export function ShoppingPage() {
  return (
    <>
      <PageHeader title="Shopping List" subtitle="What to buy, grouped by aisle." back="/more" />
      <Card>
        <EmptyState
          art={<ShoppingCart aria-hidden className="size-full text-accent-bright" />}
          title="Your list is empty"
          body="Lists generated from your plan and pantry arrive in a later release."
        />
      </Card>
    </>
  );
}

export function ExpiringPage() {
  return (
    <>
      <PageHeader title="Expiring Soon" subtitle="Dates you logged, soonest first." back="/more" />
      <Card>
        <EmptyState
          art={<Clock aria-hidden className="size-full text-accent-bright" />}
          title="Nothing to show"
          body="Once you log ingredients with use-by or best-before dates, they appear here. Dates and appearance alone do not guarantee food is safe."
        />
      </Card>
    </>
  );
}

export function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Analytics" subtitle="Built only from what you record." back="/more" />
      <Card>
        <EmptyState
          art={<BarChart3 aria-hidden className="size-full text-accent-bright" />}
          title="No data yet"
          body="Charts appear after you log ingredients and cook recipes. Nothing is estimated or invented."
        />
      </Card>
    </>
  );
}

export function CollectionsPage() {
  return (
    <>
      <PageHeader title="Collections" subtitle="Group recipes your way." back="/more" />
      <Card>
        <EmptyState
          art={<Layers aria-hidden className="size-full text-accent-bright" />}
          title="No collections"
          body="Create collections once the recipe library is available."
        />
      </Card>
    </>
  );
}

export function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <ul className="grid gap-3">
        {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="pp-card flex min-h-16 items-center gap-4 px-5 text-lg font-medium hover:bg-surface-2"
            >
              <Icon aria-hidden className="size-6 text-accent-text" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" back="/" />
      <Card>
        <EmptyState
          art={<Sprig />}
          title="We couldn't find that page"
          body="The link may be old or mistyped."
          action={<LinkButton to="/">Go home</LinkButton>}
        />
      </Card>
    </>
  );
}
