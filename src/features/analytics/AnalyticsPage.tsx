import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3 } from 'lucide-react';
import { db } from '@/data/db';
import { Card, EmptyState, inputClass, LinkButton, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { CATEGORIES } from '@/data/catalog';
import {
  categoryComposition,
  cooks,
  cooksPerWeek,
  dateBuckets,
  filterLots,
  plannedVariety,
  shoppingEstimates,
  storageDistribution,
  topIngredients,
  usedBeforeDate,
  type Filters,
} from '@/domain/analytics';
import { toISODate } from '@/lib/dates';
import { BarList, Columns, Donut } from './charts';

const RANGES: { label: string; value: number | null }[] = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'All time', value: null },
];

function Stat({ n, label, hint }: { n: ReactNode; label: string; hint?: string }) {
  return (
    <div className="pp-card flex flex-col px-4 py-4">
      <dt className="order-2 text-sm font-medium">{label}</dt>
      <dd className="order-1 font-display text-4xl font-semibold text-accent-text">{n}</dd>
      {hint && <dd className="order-3 mt-1 text-xs text-ink-soft">{hint}</dd>}
    </div>
  );
}

function Section({
  id,
  title,
  formula,
  children,
}: {
  id: string;
  title: string;
  formula: string;
  children: ReactNode;
}) {
  return (
    <Card aria-labelledby={id} className="grid content-start gap-3">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      {children}
      <p className="text-xs text-ink-soft">How this is counted: {formula}</p>
    </Card>
  );
}

const Empty = ({ children }: { children: string }) => (
  <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">{children}</p>
);

export function AnalyticsPage() {
  const { prefs } = usePrefs();
  const [rangeDays, setRange] = useState<number | null>(30);
  const [category, setCategory] = useState('');
  const [zone, setZone] = useState<Filters['zone']>('');
  const [now] = useState(() => Date.now());

  const data = useLiveQuery(async () => {
    const [lots, ingredients, sessions, entries, lists, items, events] = await Promise.all([
      db.inventoryLots.toArray(),
      db.ingredients.toArray(),
      db.cookingSessions.filter((s) => s.status === 'completed').toArray(),
      db.mealPlans.toArray(),
      db.shoppingLists.toArray(),
      db.shoppingItems.toArray(),
      db.inventoryEvents
        .where('at')
        .above(Date.now() - 400 * 86_400_000)
        .toArray(),
    ]);
    return {
      lots,
      ingredients: new Map(ingredients.map((i) => [i.id, i])),
      sessions,
      entries,
      lists,
      items,
      events,
    };
  }, []);

  const f: Filters = { rangeDays, category, zone };
  const view = useMemo(() => {
    if (!data) return undefined;
    const today = toISODate(new Date(now));
    const lots = filterLots(data.lots, data.ingredients, f);
    const done = cooks(data.sessions, f, now);
    return {
      lots,
      comp: categoryComposition(lots, data.ingredients),
      zones: storageDistribution(lots),
      dates: dateBuckets(lots, today),
      done,
      weekly: cooksPerWeek(data.sessions, new Date(now), prefs.weekStart, 8),
      top: topIngredients(done, data.ingredients, category),
      variety: plannedVariety(data.entries, new Date(now), prefs.weekStart, 4),
      money: shoppingEstimates(data.lists, data.items),
      before: usedBeforeDate(data.events, data.ingredients, prefs.expiryLeadDays, f, now),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, rangeDays, category, zone, now, prefs.weekStart, prefs.expiryLeadDays]);

  if (!data || !view) return <PageHeader title="Analytics" back="/more" />;
  const nothing =
    data.lots.length === 0 &&
    data.sessions.length === 0 &&
    data.entries.length === 0 &&
    data.lists.length === 0;
  const nearDate = view.dates.slice(1, 4).reduce((s, x) => s + x.value, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Built only from what you record. Nothing is estimated or invented."
        back="/more"
      />
      {nothing ? (
        <Card>
          <EmptyState
            art={<BarChart3 aria-hidden className="size-full text-accent-bright" />}
            title="No data yet"
            body="Charts appear after you add ingredients, cook recipes, plan meals or price a shopping list."
            action={<LinkButton to="/pantry">Add ingredients</LinkButton>}
          />
        </Card>
      ) : (
        <div className="grid gap-5">
          <Card className="flex flex-wrap items-end gap-4" aria-label="Filters">
            <div className="grid gap-1.5">
              <label htmlFor="an-range" className="text-sm font-semibold">
                Activity period
              </label>
              <select
                id="an-range"
                className={inputClass + ' w-auto'}
                value={rangeDays ?? ''}
                onChange={(e) => setRange(e.target.value ? Number(e.target.value) : null)}
              >
                {RANGES.map((r) => (
                  <option key={r.label} value={r.value ?? ''}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="an-cat" className="text-sm font-semibold">
                Ingredient category
              </label>
              <select
                id="an-cat"
                className={inputClass + ' w-auto'}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="an-zone" className="text-sm font-semibold">
                Storage place
              </label>
              <select
                id="an-zone"
                className={inputClass + ' w-auto'}
                value={zone}
                onChange={(e) => setZone(e.target.value as Filters['zone'])}
              >
                <option value="">All places</option>
                <option value="pantry">Pantry</option>
                <option value="fridge">Fridge</option>
                <option value="freezer">Freezer</option>
                <option value="custom">Other places</option>
              </select>
            </div>
            <p className="max-w-sm text-xs text-ink-soft">
              Period applies to cooking and usage. Category and place apply to the pantry charts
              (and category to the ingredient ranking).
            </p>
          </Card>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              n={view.comp.reduce((s, x) => s + x.value, 0)}
              label="Ingredients in stock"
              hint="Distinct ingredients with at least one lot"
            />
            <Stat n={view.lots.length} label="Lots" hint="Separate packages or batches" />
            <Stat
              n={nearDate}
              label="Dates in the next week"
              hint="Lots with a date within 7 days"
            />
            <Stat
              n={view.done.length}
              label="Meals cooked"
              hint={RANGES.find((r) => r.value === rangeDays)?.label}
            />
          </dl>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section
              id="an-comp"
              title="What your pantry is made of"
              formula="distinct ingredients per category, after the category and place filters. Amounts are not added because units differ."
            >
              {view.comp.length ? (
                <Donut slices={view.comp} label="Ingredients by category" centre="ingredients" />
              ) : (
                <Empty>Nothing in stock matches these filters.</Empty>
              )}
            </Section>
            <Section
              id="an-zone"
              title="Where it is stored"
              formula="number of lots in each place, after the filters."
            >
              {view.zones.length ? (
                <BarList
                  rows={view.zones}
                  unit="lots"
                  label="Lots by storage place"
                  color="var(--color-sage)"
                />
              ) : (
                <Empty>Nothing in stock matches these filters.</Empty>
              )}
            </Section>
            <Section
              id="an-dates"
              title="Dates coming up"
              formula="lots grouped by the date on the package (use-by or best-before). Lots without a date are shown separately."
            >
              {view.lots.length ? (
                <BarList
                  rows={view.dates}
                  unit="lots"
                  label="Lots by date window"
                  color="var(--color-saffron)"
                />
              ) : (
                <Empty>Nothing in stock matches these filters.</Empty>
              )}
            </Section>
            <Section
              id="an-cook"
              title="How often you cook"
              formula="finished cooks per week for the last 8 weeks. Undone cooks are not counted."
            >
              {data.sessions.some((s) => !s.undoneAt) ? (
                <Columns rows={view.weekly} label="Cooks per week" unit="Cooks" />
              ) : (
                <Empty>Finish a recipe in Cooking Mode and it will appear here.</Empty>
              )}
            </Section>
            <Section
              id="an-top"
              title="Ingredients you reach for"
              formula="number of finished cooks in the period that used each ingredient, after the category filter."
            >
              {view.top.length ? (
                <BarList rows={view.top} unit="cooks" label="Most used ingredients" />
              ) : (
                <Empty>No finished cooks with pantry deductions in this period.</Empty>
              )}
            </Section>
            <Section
              id="an-var"
              title="Variety in your plan"
              formula="meals planned with a recipe per week, and how many different recipes they were (last 4 weeks)."
            >
              {view.variety.some((v) => v.planned > 0) ? (
                <ul className="grid gap-2" aria-label="Weekly variety">
                  {view.variety.map((v) => (
                    <li key={v.label} className="flex items-baseline justify-between gap-3 text-sm">
                      <span>Week of {v.label}</span>
                      <span className="tabular-nums">
                        <strong className="font-display text-lg">{v.distinct}</strong> different
                        recipes in {v.planned} planned {v.planned === 1 ? 'meal' : 'meals'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Plan some recipes in the Meal Planner to see variety.</Empty>
              )}
            </Section>
            <Section
              id="an-money"
              title="Estimated shopping costs"
              formula="quantity × the price per kg, L or piece you typed, for items still on each list. Each list stays in its own currency; lists are never added together."
            >
              {view.money.length ? (
                <ul className="grid gap-2" aria-label="Estimates per list">
                  {view.money.map((m) => (
                    <li
                      key={m.list}
                      className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="font-semibold">{m.list}</span>
                      <span className="tabular-nums">
                        <strong className="font-display text-lg">
                          {new Intl.NumberFormat('en', {
                            style: 'currency',
                            currency: m.currency,
                          }).format(m.total)}
                        </strong>
                        <span className="ml-2 text-ink-soft">
                          {m.priced} priced{m.unpriced ? `, ${m.unpriced} without a price` : ''}
                          {m.budget != null
                            ? ` · budget ${new Intl.NumberFormat('en', { style: 'currency', currency: m.currency }).format(m.budget)}`
                            : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Add prices to shopping list items to see an estimate.</Empty>
              )}
            </Section>
            <Section
              id="an-used"
              title="Used before the date"
              formula={`times you recorded using a lot (cooking or manual use) when its date was today or up to ${prefs.expiryLeadDays} days ahead, in the period. It shows what you did, not what was saved from the bin.`}
            >
              {view.before.count > 0 ? (
                <>
                  <p className="font-display text-4xl font-semibold text-accent-text">
                    {view.before.count}
                  </p>
                  <p className="text-sm text-ink-soft">Including {view.before.names.join(', ')}.</p>
                </>
              ) : (
                <Empty>No recorded uses of lots with an upcoming date in this period.</Empty>
              )}
            </Section>
          </div>
        </div>
      )}
    </>
  );
}
