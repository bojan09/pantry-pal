import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { spriteKindFor } from '@/data/catalog';
import type { InventoryLot } from '@/data/types';
import { byFirstExpiring, expiryStatus, statusText, type IngredientSummary } from '@/domain/lots';
import { formatQuantity } from '@/domain/units';
import { colorFor, ItemSprite } from '@/design/illustrations/sprites';
import { Card, EmptyState, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { formatTotals, zoneName } from './format';
import { usePantryData } from './hooks';

function Row({
  lot,
  ing,
  text,
}: {
  lot: InventoryLot;
  ing: IngredientSummary['ingredient'];
  text: string;
}) {
  return (
    <li>
      <Link
        to={`/pantry/${ing.id}`}
        className="flex min-h-14 items-center gap-3 rounded-2xl px-2 py-1 hover:bg-surface-2"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2">
          <ItemSprite
            name={ing.name}
            kind={spriteKindFor(ing)}
            color={colorFor(ing.name, ing.id)}
            className="h-9"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{ing.name}</span>
          <span className="block text-sm text-ink-soft">
            {formatQuantity(lot.quantity, lot.unit)} · {zoneName(lot.zone, lot.customZoneName)}
          </span>
        </span>
        <span className="shrink-0 text-right text-sm font-medium">{text}</span>
      </Link>
    </li>
  );
}

function Section({
  id,
  title,
  hint,
  lots,
  ingById,
  today,
  leadDays,
}: {
  id: string;
  title: string;
  hint?: string;
  lots: InventoryLot[];
  ingById: Map<string, IngredientSummary['ingredient']>;
  today: string;
  leadDays: number;
}) {
  if (lots.length === 0) return null;
  return (
    <Card aria-labelledby={id}>
      <h2 id={id} className="text-xl font-semibold">
        {title} <span className="text-base font-normal text-ink-soft">({lots.length})</span>
      </h2>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      <ul className="mt-2 divide-y divide-line">
        {lots.map((l) => (
          <Row
            key={l.id}
            lot={l}
            ing={ingById.get(l.ingredientId)!}
            text={statusText(l, today, leadDays)}
          />
        ))}
      </ul>
    </Card>
  );
}

export function ExpiringPage() {
  const data = usePantryData();
  const { prefs } = usePrefs();
  if (!data) return <PageHeader title="Expiring Soon" back="/more" />;
  const ingById = new Map(data.ingredients.map((i) => [i.id, i]));
  const withStatus = data.lots.map((l) => ({
    lot: l,
    st: expiryStatus(l, data.today, data.leadDays),
  }));
  const pick = (st: string) =>
    withStatus
      .filter((x) => x.st === st)
      .map((x) => x.lot)
      .sort(byFirstExpiring);
  const past = pick('expired');
  const soon = pick('soon');
  const none = pick('none');
  const low = data.all.filter((s) => s.low);

  const nothing = past.length + soon.length + none.length + low.length === 0;
  return (
    <>
      <PageHeader
        title="Expiring Soon"
        subtitle={`Dates you logged. “Soon” means within ${prefs.expiryLeadDays} days.`}
        back="/more"
      />
      <p className="mb-4 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
        <strong className="text-ink">Use-by</strong> dates relate to safety;{' '}
        <strong className="text-ink">best-before</strong> dates relate to quality. This page only
        sorts the dates you entered. It cannot tell you whether food is safe to eat: dates and
        appearance alone do not guarantee that.
      </p>
      {nothing ? (
        <Card>
          <EmptyState
            art={<Clock aria-hidden className="size-full text-accent-bright" />}
            title="Nothing to show"
            body="Log ingredients with a use-by or best-before date and they appear here, soonest first."
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          <Section
            ingById={ingById}
            today={data.today}
            leadDays={data.leadDays}
            id="past-h"
            title="Date has passed"
            hint="Check these before using. Past a best-before date is a quality question; past a use-by date, follow the package guidance."
            lots={past}
          />
          <Section
            ingById={ingById}
            today={data.today}
            leadDays={data.leadDays}
            id="soon-h"
            title="Coming up"
            lots={soon}
          />
          {low.length > 0 && (
            <Card aria-labelledby="low-h">
              <h2 id="low-h" className="text-xl font-semibold">
                Low stock{' '}
                <span className="text-base font-normal text-ink-soft">({low.length})</span>
              </h2>
              <ul className="mt-2 divide-y divide-line">
                {low.map((s) => (
                  <li key={s.ingredient.id}>
                    <Link
                      to={`/pantry/${s.ingredient.id}`}
                      className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-2 hover:bg-surface-2"
                    >
                      <span className="font-semibold">{s.ingredient.name}</span>
                      <span className="text-sm text-ink-soft">
                        {formatTotals(s.totals, prefs.units)} left
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Section
            ingById={ingById}
            today={data.today}
            leadDays={data.leadDays}
            id="none-h"
            title="No date logged"
            hint="These never appear in expiry alerts."
            lots={none}
          />
        </div>
      )}
    </>
  );
}
