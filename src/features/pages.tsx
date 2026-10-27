import { Link, useParams } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarDays, Clock, Layers, ShoppingCart } from 'lucide-react';
import { Basket, Sprig, Tomato } from '@/design/illustrations';
import { Card, EmptyState, LinkButton, PageHeader } from '@/design/ui';
import { MORE_ITEMS } from '@/app/nav';

export function PantryPage() {
  return (
    <>
      <PageHeader title="My Pantry" subtitle="Everything you have, by shelf." />
      <Card>
        <EmptyState
          art={<Basket />}
          title="Your pantry is empty"
          body="Nothing is logged yet. Adding ingredients, quantities and dates arrives in the next release."
        />
      </Card>
    </>
  );
}

export function RecipesPage() {
  return (
    <>
      <PageHeader title="Recipes" subtitle="Your cookbook, searchable offline." />
      <Card>
        <EmptyState
          art={<BookOpen aria-hidden className="size-full text-accent-bright" />}
          title="No recipes yet"
          body="The starter cookbook and your own recipes will live here once the recipe library is built."
        />
      </Card>
    </>
  );
}

export function RecipeDetailPage() {
  const { id } = useParams();
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
  return (
    <>
      <PageHeader title="Meal Planner" subtitle="Plan breakfast, lunch, dinner and snacks." />
      <Card>
        <EmptyState
          art={<CalendarDays aria-hidden className="size-full text-accent-bright" />}
          title="Nothing planned"
          body="Scheduling recipes into your week arrives in a later release."
        />
      </Card>
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
