import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Play,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import { db } from '@/data/db';
import { planner } from '@/data/planner';
import type { MealPlanEntry, Recipe } from '@/data/types';
import { Button, Card, cx, EmptyState, IconButton, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { cellEntries, slotLabel, slotsFor } from '@/domain/planning';
import { addDays, fromISODate, toISODate, weekDays } from '@/lib/dates';
import { GenerateDialog } from '../shopping/GenerateDialog';
import { EntryDialog } from './EntryDialog';

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en', o).format(d);

type Dlg =
  | { kind: 'add'; date: string; slot: string }
  | { kind: 'edit'; entry: MealPlanEntry }
  | { kind: 'shop' }
  | null;

export function PlannerPage() {
  const { prefs } = usePrefs();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const anchorStr = params.get('date');
  const anchor =
    anchorStr && /^\d{4}-\d{2}-\d{2}$/.test(anchorStr) ? fromISODate(anchorStr) : new Date();
  const days = weekDays(anchor, prefs.weekStart);
  const first = toISODate(days[0]);
  const last = toISODate(days[6]);
  const today = toISODate(new Date());
  const [dlg, setDlg] = useState<Dlg>(null);
  const [dragging, setDragging] = useState<string>();
  const [over, setOver] = useState<string>();

  const data = useLiveQuery(async () => {
    const [entries, recipes] = await Promise.all([
      db.mealPlans.where('date').between(first, last, true, true).toArray(),
      db.recipes.toArray(),
    ]);
    return { entries, recipes: new Map<string, Recipe>(recipes.map((r) => [r.id, r])) };
  }, [first, last]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const slots = slotsFor(entries);
  const shift = (n: number) => {
    const next = new URLSearchParams(params);
    next.set('date', toISODate(addDays(days[0], n * 7)));
    setParams(next, { replace: true });
  };
  const toShop = entries
    .filter((e) => e.recipeId && !e.done)
    .map((e) => ({ recipeId: e.recipeId!, servings: e.servings }));

  async function drop(date: string, slot: string, id: string) {
    setOver(undefined);
    setDragging(undefined);
    try {
      await planner.updateEntry(id, { date, slot });
    } catch (e) {
      toast({
        message: e instanceof Error ? e.message : 'Could not move that meal',
        tone: 'error',
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Meal Planner"
        subtitle="Plan breakfast, lunch, dinner and snacks."
        actions={
          <Button
            onClick={() =>
              setDlg({
                kind: 'add',
                date: today >= first && today <= last ? today : first,
                slot: 'dinner',
              })
            }
          >
            <Plus aria-hidden className="size-4" /> Plan a meal
          </Button>
        }
      />
      <div className="grid gap-4">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconButton label="Previous week" onClick={() => shift(-1)}>
              <ChevronLeft aria-hidden className="size-5" />
            </IconButton>
            <h2 className="min-w-48 text-center text-lg font-semibold" aria-live="polite">
              {fmt(days[0], { month: 'short', day: 'numeric' })} –{' '}
              {fmt(days[6], { month: 'short', day: 'numeric', year: 'numeric' })}
            </h2>
            <IconButton label="Next week" onClick={() => shift(1)}>
              <ChevronRight aria-hidden className="size-5" />
            </IconButton>
            {!(today >= first && today <= last) && (
              <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
                This week
              </Button>
            )}
          </div>
          <Button
            variant="soft"
            disabled={toShop.length === 0}
            onClick={() => setDlg({ kind: 'shop' })}
          >
            <ShoppingCart aria-hidden className="size-4" /> Shopping list for this week
          </Button>
        </Card>

        {data && entries.length === 0 && (
          <Card>
            <EmptyState
              art={<CalendarDays aria-hidden className="size-full text-accent-bright" />}
              title="Nothing planned this week"
              body="Plan a recipe for any day, then turn the week into a shopping list that already subtracts what you have."
              action={
                <Button
                  onClick={() =>
                    setDlg({
                      kind: 'add',
                      date: today >= first && today <= last ? today : first,
                      slot: 'dinner',
                    })
                  }
                >
                  Plan a meal
                </Button>
              }
            />
          </Card>
        )}

        <ol
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 min-[1800px]:grid-cols-7"
          aria-label="Days of the week"
        >
          {days.map((d) => {
            const iso = toISODate(d);
            const isToday = iso === today;
            return (
              <li
                key={iso}
                className={cx(
                  'pp-card grid content-start gap-2 p-3',
                  isToday && 'ring-2 ring-accent',
                )}
              >
                <h3 className="font-display text-lg font-semibold">
                  {fmt(d, { weekday: 'short' })}{' '}
                  <span className="text-ink-soft">
                    {fmt(d, { day: 'numeric', month: 'short' })}
                  </span>
                  {isToday && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink">
                      Today
                    </span>
                  )}
                </h3>
                {slots.map((slot) => {
                  const cell = cellEntries(entries, iso, slot);
                  const cellKey = `${iso}|${slot}`;
                  return (
                    <section
                      key={slot}
                      aria-label={`${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}, ${slotLabel(slot)}`}
                      onDragOver={(e) => {
                        if (!dragging) return;
                        e.preventDefault();
                        setOver(cellKey);
                      }}
                      onDragLeave={() => setOver((o) => (o === cellKey ? undefined : o))}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('text/plain') || dragging;
                        if (id) void drop(iso, slot, id);
                      }}
                      className={cx(
                        'grid gap-1.5 rounded-2xl p-2',
                        over === cellKey
                          ? 'bg-accent-soft outline-dashed outline-2 outline-accent'
                          : 'bg-surface-2',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                          {slotLabel(slot)}
                        </h4>
                        <button
                          type="button"
                          aria-label={`Add to ${slotLabel(slot)} on ${fmt(d, { weekday: 'long' })}`}
                          onClick={() => setDlg({ kind: 'add', date: iso, slot })}
                          className="pp-lift grid size-11 place-items-center rounded-full text-accent-text hover:bg-surface"
                        >
                          <Plus aria-hidden className="size-4" />
                        </button>
                      </div>
                      {cell.map((e) => {
                        const r = e.recipeId ? data?.recipes.get(e.recipeId) : undefined;
                        const name = r?.name ?? e.label ?? 'Meal';
                        return (
                          <article
                            key={e.id}
                            draggable
                            onDragStart={(ev) => {
                              ev.dataTransfer.setData('text/plain', e.id);
                              ev.dataTransfer.effectAllowed = 'move';
                              setDragging(e.id);
                            }}
                            onDragEnd={() => {
                              setDragging(undefined);
                              setOver(undefined);
                            }}
                            className={cx(
                              'grid gap-1 rounded-xl bg-surface p-2 shadow-sm',
                              e.done && 'opacity-60',
                              dragging === e.id && 'opacity-40',
                            )}
                          >
                            <p
                              className={cx(
                                'text-sm font-semibold leading-snug',
                                e.done && 'line-through',
                              )}
                            >
                              {r ? (
                                <Link
                                  to={`/recipes/${r.id}?servings=${e.servings}`}
                                  className="hover:underline"
                                >
                                  {name}
                                </Link>
                              ) : (
                                name
                              )}
                            </p>
                            <p className="text-xs text-ink-soft">
                              {e.servings} {e.servings === 1 ? 'serving' : 'servings'}
                              {e.done && ' · done'}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {r && !e.done && (
                                <Link
                                  to={`/recipes/${r.id}/cook?servings=${e.servings}&plan=${e.id}`}
                                  aria-label={`Cook ${name}`}
                                  className="pp-lift grid size-11 place-items-center rounded-full border border-line"
                                >
                                  <Play aria-hidden className="size-4" />
                                </Link>
                              )}
                              <button
                                type="button"
                                aria-label={
                                  e.done ? `Mark ${name} as not done` : `Mark ${name} as done`
                                }
                                aria-pressed={!!e.done}
                                onClick={() => void planner.setDone(e.id, !e.done)}
                                className="pp-lift grid size-11 place-items-center rounded-full border border-line"
                              >
                                <Check aria-hidden className="size-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Edit or move ${name}`}
                                onClick={() => setDlg({ kind: 'edit', entry: e })}
                                className="pp-lift grid size-11 place-items-center rounded-full border border-line"
                              >
                                <Pencil aria-hidden className="size-4" />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </section>
                  );
                })}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-ink-soft">
          Drag a meal to another day or meal, or use the pencil button to move it with the keyboard
          or on a phone. Planning never changes your pantry: stock only changes when you finish
          cooking or confirm a purchase.
        </p>
      </div>

      {dlg?.kind === 'add' && (
        <EntryDialog defaults={{ date: dlg.date, slot: dlg.slot }} onClose={() => setDlg(null)} />
      )}
      {dlg?.kind === 'edit' && (
        <EntryDialog
          entry={dlg.entry}
          defaults={{ date: dlg.entry.date, slot: dlg.entry.slot }}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg?.kind === 'shop' && (
        <GenerateDialog
          title="Shopping list for this week"
          demands={toShop}
          onClose={() => setDlg(null)}
        />
      )}
    </>
  );
}
