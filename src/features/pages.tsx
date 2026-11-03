import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarDays, Layers, ShoppingCart } from 'lucide-react';
import { Art, Sprig, Tomato } from '@/design/illustrations';
import { Card, EmptyState, LinkButton, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { RecipeCard, SampleBanner } from './RecipeCard';
import { SAMPLE_RECIPES, SAMPLE_WEEK } from './sample';
import { MORE_ITEMS } from '@/app/nav';
import { toISODate, weekDays } from '@/lib/dates';

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
