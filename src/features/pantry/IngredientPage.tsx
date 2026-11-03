import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Minus, Pencil, Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import { db } from '@/data/db';
import { inventory } from '@/data/inventory';
import { spriteKindFor } from '@/data/catalog';
import type { InventoryEvent, InventoryLot } from '@/data/types';
import {
  byFirstExpiring,
  dateLabelText,
  expiryStatus,
  isLowStock,
  statusText,
  totalsFor,
} from '@/domain/lots';
import { formatQuantity } from '@/domain/units';
import { colorFor, ItemSprite } from '@/design/illustrations/sprites';
import { Button, Card, cx, EmptyState, LinkButton, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { ConfirmDialog, LotFormDialog, MoveDialog, UseDialog } from './dialogs';
import { formatTotals, STATUS_CLASS, STATUS_WORD, zoneName } from './format';
import { useToday } from './hooks';

const EVENT_WORD: Record<InventoryEvent['type'], string> = {
  add: 'Added',
  use: 'Used',
  transfer: 'Moved',
  discard: 'Discarded',
  correct: 'Corrected',
  purchase: 'Purchased',
};

type Dlg =
  | null
  | { kind: 'add' }
  | { kind: 'use' }
  | { kind: 'edit' | 'move' | 'discard'; lot: InventoryLot };

export function IngredientPage() {
  const { id = '' } = useParams();
  const { prefs } = usePrefs();
  const toast = useToast();
  const today = useToday();
  const [dlg, setDlg] = useState<Dlg>(null);
  const loaded = useLiveQuery(
    async () => ({
      ingredient: (await db.ingredients.get(id)) ?? null,
      lots: await db.inventoryLots.where('ingredientId').equals(id).toArray(),
      events: (
        await db.inventoryEvents.where('ingredientId').equals(id).reverse().sortBy('at')
      ).slice(0, 25),
    }),
    [id],
  );

  if (!loaded) return <PageHeader title="Ingredient" back="/pantry" />;
  const { ingredient, lots, events } = loaded;
  if (!ingredient) {
    return (
      <>
        <PageHeader title="Ingredient" back="/pantry" />
        <Card>
          <EmptyState
            title="Ingredient not found"
            body="It may have been removed."
            action={<LinkButton to="/pantry">Back to pantry</LinkButton>}
          />
        </Card>
      </>
    );
  }
  const sorted = [...lots].sort(byFirstExpiring);
  const low = isLowStock(lots, ingredient.densityGPerMl);

  return (
    <>
      <PageHeader title={ingredient.name} subtitle={ingredient.category} back="/pantry" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-4">
          <Card className="flex flex-wrap items-center gap-4">
            <span className="grid size-24 place-items-center rounded-3xl bg-gradient-to-br from-oat to-surface-2">
              <ItemSprite
                name={ingredient.name}
                kind={spriteKindFor(ingredient)}
                color={colorFor(ingredient.name, ingredient.id)}
                className="h-20"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-soft">In stock</p>
              <p className="font-display text-3xl font-semibold">
                {formatTotals(totalsFor(lots), prefs.units)}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {low && (
                  <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-semibold text-warn">
                    Low stock
                  </span>
                )}
                {ingredient.allergens.length > 0 && (
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium">
                    Contains: {ingredient.allergens.join(', ')} (informational)
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDlg({ kind: 'add' })}>
                <Plus aria-hidden className="size-4" /> Add stock
              </Button>
              <Button
                variant="ghost"
                disabled={lots.length === 0}
                onClick={() => setDlg({ kind: 'use' })}
              >
                <Minus aria-hidden className="size-4" /> Use some
              </Button>
            </div>
          </Card>

          <section aria-labelledby="lots-h" className="grid gap-3">
            <h2
              id="lots-h"
              className="w-fit text-2xl font-semibold lg:rounded-full lg:bg-surface lg:px-5 lg:py-1.5 lg:shadow-card"
            >
              Lots
            </h2>
            {sorted.length === 0 && (
              <Card>
                <p className="text-ink-soft">No stock logged. Add some to start tracking it.</p>
              </Card>
            )}
            {sorted.map((l) => {
              const st = expiryStatus(l, today, prefs.expiryLeadDays);
              return (
                <Card key={l.id} as="article" className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xl font-semibold">{formatQuantity(l.quantity, l.unit)}</p>
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium">
                      {zoneName(l.zone, l.customZoneName)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cx(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        STATUS_CLASS[st],
                      )}
                    >
                      {STATUS_WORD[st]}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {l.dateLabel !== 'unknown' && l.date
                        ? `${dateLabelText(l.dateLabel)} ${l.date} · `
                        : ''}
                      {statusText(l, today, prefs.expiryLeadDays)}
                    </span>
                  </div>
                  {(l.purchasedOn || l.openedOn || l.cost != null || l.note) && (
                    <p className="text-sm text-ink-soft">
                      {[
                        l.purchasedOn && `Bought ${l.purchasedOn}`,
                        l.openedOn && `Opened ${l.openedOn}`,
                        l.cost != null && `${l.cost} ${l.currency ?? ''}`,
                        l.note,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => setDlg({ kind: 'edit', lot: l })}>
                      <Pencil aria-hidden className="size-4" /> Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setDlg({ kind: 'move', lot: l })}>
                      <ArrowRightLeft aria-hidden className="size-4" /> Move
                    </Button>
                    <Button variant="ghost" onClick={() => setDlg({ kind: 'discard', lot: l })}>
                      <Trash2 aria-hidden className="size-4" /> Discard
                    </Button>
                  </div>
                </Card>
              );
            })}
          </section>
        </div>

        <Card aria-labelledby="hist-h" className="content-start self-start">
          <h2 id="hist-h" className="text-xl font-semibold">
            History
          </h2>
          {events.length === 0 ? (
            <p className="mt-2 text-ink-soft">Nothing yet.</p>
          ) : (
            <ol className="mt-2 divide-y divide-line">
              {events.map((e) => (
                <li key={e.id} className="py-2 text-sm">
                  <span className="font-semibold">{EVENT_WORD[e.type]}</span>
                  {e.delta !== 0 && (
                    <>
                      {' '}
                      {e.delta > 0 ? '+' : ''}
                      {formatQuantity(e.delta, e.unit)}
                    </>
                  )}
                  {e.note && e.note !== 'Edited' && (
                    <span className="text-ink-soft"> · {e.note}</span>
                  )}
                  <span className="block text-xs text-ink-soft">
                    {new Intl.DateTimeFormat('en', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(e.at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {dlg?.kind === 'add' && (
        <LotFormDialog ingredientId={ingredient.id} onClose={() => setDlg(null)} />
      )}
      {dlg?.kind === 'edit' && <LotFormDialog lot={dlg.lot} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'use' && (
        <UseDialog ingredient={ingredient} lots={lots} onClose={() => setDlg(null)} />
      )}
      {dlg?.kind === 'move' && <MoveDialog lots={[dlg.lot]} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'discard' && (
        <ConfirmDialog
          title={`Discard ${formatQuantity(dlg.lot.quantity, dlg.lot.unit)} of ${ingredient.name}?`}
          confirmLabel="Discard"
          danger
          onClose={() => setDlg(null)}
          onConfirm={async () => {
            const { lot } = await inventory.discardLot(dlg.lot.id);
            toast({
              message: `Discarded ${ingredient.name}`,
              action: {
                label: 'Undo',
                run: () =>
                  inventory.undo([lot]).catch((x) => toast({ message: x.message, tone: 'error' })),
              },
            });
          }}
        >
          This removes the lot from your pantry. You can undo right after.
        </ConfirmDialog>
      )}
    </>
  );
}
