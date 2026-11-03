import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  Pencil,
  Play,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import { db } from '@/data/db';
import { planner } from '@/data/planner';
import type { MealPlanEntry, Recipe } from '@/data/types';
import { Button, Card, cx, EmptyState, IconButton, PageHeader, Segmented } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { cellEntries, slotLabel, slotsFor } from '@/domain/planning';
import { addDays, fromISODate, toISODate, weekDays } from '@/lib/dates';
import { GenerateDialog } from '../shopping/GenerateDialog';
import { CopyWeekDialog } from './CopyWeekDialog';
import { EntryDialog } from './EntryDialog';
import { MonthView } from './MonthView';

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en', o).format(d);

type Dlg =
  | { kind: 'add'; date: string; slot: string }
  | { kind: 'edit'; entry: MealPlanEntry }
  | { kind: 'shop' }
  | { kind: 'copy' }
  | null;

const parseCell = (key: string | undefined) => {
  if (!key) return undefined;
  const [date, ...rest] = key.split('|');
  return { date, slot: rest.join('|') };
};

export function PlannerPage() {
  const { prefs } = usePrefs();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const anchorStr = params.get('date');
  const anchor =
    anchorStr && /^\d{4}-\d{2}-\d{2}$/.test(anchorStr) ? fromISODate(anchorStr) : new Date();
  const view = params.get('view') === 'month' ? 'month' : 'week';
  const days = weekDays(anchor, prefs.weekStart);
  const first = toISODate(days[0]);
  const last = toISODate(days[6]);
  const today = toISODate(new Date());
  const [dlg, setDlg] = useState<Dlg>(null);
  const [dragging, setDragging] = useState<string>();
  const [over, setOver] = useState<string>();
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string }>();

  const data = useLiveQuery(async () => {
    const [entries, recipes] = await Promise.all([
      db.mealPlans.where('date').between(first, last, true, true).toArray(),
      db.recipes.toArray(),
    ]);
    return { entries, recipes: new Map<string, Recipe>(recipes.map((r) => [r.id, r])) };
  }, [first, last]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const slots = slotsFor(entries);
  const inWeek = today >= first && today <= last;

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const shift = (n: number) =>
    setParam(
      'date',
      toISODate(
        view === 'month'
          ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)
          : addDays(days[0], n * 7),
      ),
    );

  // Only meals that are still ahead and not done feed the shopping list.
  const upcoming = entries.filter((e) => e.recipeId && !e.done && e.date >= today);
  const skippedPast = entries.filter((e) => e.recipeId && !e.done && e.date < today).length;
  const toShop = upcoming.map((e) => ({ recipeId: e.recipeId!, servings: e.servings }));

  async function drop(id: string, to: { date: string; slot: string; index?: number }) {
    setOver(undefined);
    setDragging(undefined);
    setGhost(undefined);
    try {
      await planner.moveTo(id, to);
    } catch (e) {
      toast({
        message: e instanceof Error ? e.message : 'Could not move that meal',
        tone: 'error',
      });
    }
  }

  /* ---- touch: press and hold a meal, then drag it (scrolling still works before the hold) ---- */
  const touch = useRef<{
    id: string;
    label: string;
    timer?: number;
    active: boolean;
    sx: number;
    sy: number;
  } | null>(null);
  const dropRef = useRef(drop);
  useEffect(() => {
    dropRef.current = drop;
  });
  useEffect(() => {
    const cellAt = (x: number, y: number) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]')?.dataset.cell;
    const onMove = (e: PointerEvent) => {
      const t = touch.current;
      if (!t || e.pointerType !== 'touch') return;
      if (!t.active) {
        if (Math.hypot(e.clientX - t.sx, e.clientY - t.sy) > 10) {
          window.clearTimeout(t.timer);
          touch.current = null; // the finger moved first: it was a scroll
        }
        return;
      }
      setGhost({ x: e.clientX, y: e.clientY, label: t.label });
      setOver(cellAt(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      const t = touch.current;
      if (!t) return;
      window.clearTimeout(t.timer);
      touch.current = null;
      if (!t.active) return;
      const to = parseCell(cellAt(e.clientX, e.clientY));
      if (to) void dropRef.current(t.id, to);
      else {
        setDragging(undefined);
        setOver(undefined);
        setGhost(undefined);
      }
    };
    const block = (e: TouchEvent) => {
      if (touch.current?.active) e.preventDefault();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('touchmove', block, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('touchmove', block);
    };
  }, []);

  const startTouch = (e: React.PointerEvent, entry: MealPlanEntry, label: string) => {
    if (e.pointerType !== 'touch') return;
    const t = { id: entry.id, label, active: false, sx: e.clientX, sy: e.clientY, timer: 0 };
    t.timer = window.setTimeout(() => {
      t.active = true;
      setDragging(entry.id);
      navigator.vibrate?.(15);
    }, 380);
    touch.current = t;
  };

  const addDefault = { kind: 'add' as const, date: inWeek ? today : first, slot: 'dinner' };

  return (
    <>
      <PageHeader
        title="Meal Planner"
        subtitle="Plan breakfast, lunch, dinner and snacks."
        actions={
          <Button onClick={() => setDlg(addDefault)}>
            <Plus aria-hidden className="size-4" /> Plan a meal
          </Button>
        }
      />
      <div className="grid gap-4">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <IconButton
              label={view === 'month' ? 'Previous month' : 'Previous week'}
              onClick={() => shift(-1)}
            >
              <ChevronLeft aria-hidden className="size-5" />
            </IconButton>
            <h2 className="min-w-48 text-center text-lg font-semibold" aria-live="polite">
              {view === 'month'
                ? fmt(anchor, { month: 'long', year: 'numeric' })
                : `${fmt(days[0], { month: 'short', day: 'numeric' })} – ${fmt(days[6], { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </h2>
            <IconButton
              label={view === 'month' ? 'Next month' : 'Next week'}
              onClick={() => shift(1)}
            >
              <ChevronRight aria-hidden className="size-5" />
            </IconButton>
            {!(inWeek && view === 'week') && (
              <Button
                variant="ghost"
                onClick={() =>
                  setParams(view === 'month' ? { view: 'month' } : {}, { replace: true })
                }
              >
                {view === 'month' ? 'This month' : 'This week'}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="View"
              value={view}
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
              onChange={(v) => setParam('view', v === 'month' ? 'month' : null)}
            />
            {view === 'week' && (
              <>
                <Button
                  variant="ghost"
                  disabled={entries.length === 0}
                  onClick={() => setDlg({ kind: 'copy' })}
                >
                  <Copy aria-hidden className="size-4" /> Copy week
                </Button>
                <Button
                  variant="soft"
                  disabled={toShop.length === 0}
                  onClick={() => setDlg({ kind: 'shop' })}
                >
                  <ShoppingCart aria-hidden className="size-4" /> Shopping list for this week
                </Button>
              </>
            )}
          </div>
        </Card>

        {view === 'month' ? (
          <MonthView
            anchor={anchor}
            weekStart={prefs.weekStart}
            today={today}
            onPick={(iso) => setParams({ date: iso }, { replace: true })}
          />
        ) : (
          <>
            {data && entries.length === 0 && (
              <Card>
                <EmptyState
                  art={<CalendarDays aria-hidden className="size-full text-accent-bright" />}
                  title="Nothing planned this week"
                  body="Plan a recipe for any day, then turn the week into a shopping list that already subtracts what you have."
                  action={<Button onClick={() => setDlg(addDefault)}>Plan a meal</Button>}
                />
              </Card>
            )}
            {skippedPast > 0 && (
              <p className="rounded-2xl bg-warn-soft px-4 py-2 text-sm text-warn">
                {skippedPast} earlier meal{skippedPast === 1 ? '' : 's'} this week{' '}
                {skippedPast === 1 ? 'is' : 'are'} not marked done and{' '}
                {skippedPast === 1 ? 'is' : 'are'} left out of the shopping list. Mark{' '}
                {skippedPast === 1 ? 'it' : 'them'} done or move {skippedPast === 1 ? 'it' : 'them'}{' '}
                forward to include {skippedPast === 1 ? 'it' : 'them'}.
              </p>
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
                          data-cell={cellKey}
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
                            if (id) void drop(id, { date: iso, slot });
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
                          {cell.map((e, index) => {
                            const r = e.recipeId ? data?.recipes.get(e.recipeId) : undefined;
                            const name = r?.name ?? e.label ?? 'Meal';
                            return (
                              <article
                                key={e.id}
                                draggable
                                onPointerDown={(ev) => startTouch(ev, e, name)}
                                onDragStart={(ev) => {
                                  ev.dataTransfer.setData('text/plain', e.id);
                                  ev.dataTransfer.effectAllowed = 'move';
                                  setDragging(e.id);
                                }}
                                onDragEnd={() => {
                                  setDragging(undefined);
                                  setOver(undefined);
                                }}
                                onDragOver={(ev) => {
                                  if (dragging && dragging !== e.id) {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    setOver(cellKey);
                                  }
                                }}
                                onDrop={(ev) => {
                                  ev.preventDefault();
                                  ev.stopPropagation();
                                  const id = ev.dataTransfer.getData('text/plain') || dragging;
                                  if (id && id !== e.id) void drop(id, { date: iso, slot, index });
                                }}
                                className={cx(
                                  'grid touch-pan-y gap-1 rounded-xl bg-surface p-2 shadow-sm',
                                  e.done && 'opacity-60',
                                  dragging === e.id && 'opacity-40',
                                )}
                              >
                                <p
                                  className={cx(
                                    'flex items-start gap-1 text-sm font-semibold leading-snug',
                                    e.done && 'line-through',
                                  )}
                                >
                                  <GripVertical
                                    aria-hidden
                                    className="mt-0.5 size-4 shrink-0 text-ink-soft"
                                  />
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
              Drag a meal onto another day, meal or position. On a phone, press and hold a meal,
              then drag. The pencil button moves, reorders and repeats meals with the keyboard.
              Planning never changes your pantry: stock only changes when you finish cooking or
              confirm a purchase.
            </p>
          </>
        )}
      </div>

      {ghost && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 max-w-48 -translate-x-1/2 -translate-y-1/2 truncate rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink shadow-card"
          style={{ left: ghost.x, top: ghost.y - 28 }}
        >
          {ghost.label}
        </div>
      )}

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
      {dlg?.kind === 'copy' && (
        <CopyWeekDialog
          fromStart={first}
          weekStart={prefs.weekStart}
          onClose={() => setDlg(null)}
        />
      )}
    </>
  );
}
