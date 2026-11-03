import { Link } from 'react-router-dom';
import { BarChart3, CalendarDays, ShoppingCart } from 'lucide-react';
import { Art, Sprig } from '@/design/illustrations';
import { Card, EmptyState, LinkButton, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { SampleBanner } from './RecipeCard';
import { SAMPLE_WEEK } from './sample';
import { MORE_ITEMS } from '@/app/nav';
import { toISODate, weekDays } from '@/lib/dates';

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
