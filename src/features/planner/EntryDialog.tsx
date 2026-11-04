import { useMemo, useState } from 'react';
import { errorMessage } from '@/data/errors';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Repeat, Trash2 } from 'lucide-react';
import { db } from '@/data/db';
import { planner } from '@/data/planner';
import type { MealPlanEntry, Recipe } from '@/data/types';
import { Button, cx, Dialog, inputClass } from '@/design/ui';
import { useToast } from '@/app/Toast';
import { slotLabel, STANDARD_SLOTS } from '@/domain/planning';
import { addDays, fromISODate, toISODate } from '@/lib/dates';

const OTHER = '__other__';

export function EntryDialog({
  entry,
  defaults,
  onClose,
}: {
  /** edit this entry; omit to add a new one */
  entry?: MealPlanEntry;
  defaults: { date: string; slot: string; recipeId?: string };
  onClose: () => void;
}) {
  const toast = useToast();
  const editing = !!entry;
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), [], [] as Recipe[]);
  const customSlots = useLiveQuery(
    async () =>
      [...new Set((await db.mealPlans.toArray()).map((e) => e.slot))].filter(
        (s) => !(STANDARD_SLOTS as readonly string[]).includes(s),
      ),
    [],
    [] as string[],
  );

  const initialRecipe = entry?.recipeId ?? defaults.recipeId;
  const [kind, setKind] = useState<'recipe' | 'note'>(entry && !entry.recipeId ? 'note' : 'recipe');
  const [recipeId, setRecipeId] = useState(initialRecipe);
  const [q, setQ] = useState('');
  const [note, setNote] = useState(entry?.label ?? '');
  const [date, setDate] = useState(entry?.date ?? defaults.date);
  const slotInit = entry?.slot ?? defaults.slot;
  const isStd = (STANDARD_SLOTS as readonly string[]).includes(slotInit);
  const [slot, setSlot] = useState(isStd ? slotInit : OTHER);
  const [otherSlot, setOtherSlot] = useState(isStd ? '' : slotInit);
  const [servings, setServings] = useState(
    String(entry?.servings ?? recipes.find((r) => r.id === initialRecipe)?.servings ?? 2),
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [repeat, setRepeat] = useState<'none' | 'day' | 'week'>('none');
  const [repeatCount, setRepeatCount] = useState('4');

  const picked = recipes.find((r) => r.id === recipeId);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? recipes.filter((r) => r.name.toLowerCase().includes(t)) : recipes).slice(0, 6);
  }, [recipes, q]);
  const finalSlot = slot === OTHER ? otherSlot.trim() : slot;

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      if (done) toast({ message: done });
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Something went wrong'));
      setBusy(false);
    }
  }

  const input = () => ({
    date,
    slot: finalSlot,
    servings: Number(servings),
    recipeId: kind === 'recipe' ? recipeId : undefined,
    label: kind === 'note' ? note : undefined,
  });

  const shiftDay = (n: number) =>
    run(
      () =>
        planner.updateEntry(entry!.id, { date: toISODate(addDays(fromISODate(entry!.date), n)) }),
      n > 0 ? 'Moved to the next day' : 'Moved to the previous day',
    );

  return (
    <Dialog open onClose={onClose} title={editing ? 'Edit planned meal' : 'Plan a meal'}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (editing)
            void run(
              () =>
                planner.updateEntry(entry.id, {
                  date,
                  slot: finalSlot,
                  servings: Number(servings),
                  label: kind === 'note' ? note : undefined,
                }),
              'Saved',
            );
          else
            void run(
              async () => {
                const added = await planner.addEntry(input());
                if (repeat !== 'none')
                  await planner.repeatEntry(added.id, repeat, Number(repeatCount));
              },
              repeat === 'none' ? 'Added to your plan' : 'Added and repeated',
            );
        }}
      >
        {!editing && (
          <div
            role="radiogroup"
            aria-label="What to plan"
            className="inline-flex gap-1 rounded-full bg-surface-2 p-1"
          >
            {(['recipe', 'note'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cx(
                  'min-h-11 flex-1 rounded-full px-4 text-sm font-semibold',
                  kind === k ? 'bg-accent text-accent-ink' : 'text-ink-soft',
                )}
              >
                {k === 'recipe' ? 'A recipe' : 'A note (e.g. Leftovers)'}
              </button>
            ))}
          </div>
        )}

        {kind === 'recipe' ? (
          editing || picked ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-2">
              <span className="font-semibold">{picked?.name ?? 'Recipe'}</span>
              {!editing && (
                <Button variant="ghost" onClick={() => setRecipeId(undefined)}>
                  Change
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <input
                aria-label="Search recipes to plan"
                placeholder="Search recipes"
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <ul aria-label="Matching recipes" className="grid max-h-48 gap-1 overflow-y-auto">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setRecipeId(r.id);
                        setServings(String(r.servings));
                      }}
                      className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left hover:bg-surface-2"
                    >
                      <span>{r.name}</span>
                      <span className="text-xs text-ink-soft">
                        {r.prepMinutes + r.cookMinutes} min
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <div className="grid gap-1.5">
            <label htmlFor="plan-note" className="text-sm font-semibold">
              Note
            </label>
            <input
              id="plan-note"
              className={inputClass}
              placeholder="Leftovers, eating out…"
              maxLength={60}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-sm text-ink-soft">
              Notes do not change your pantry or shopping needs.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="plan-date" className="text-sm font-semibold">
              Date
            </label>
            <input
              id="plan-date"
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="plan-slot" className="text-sm font-semibold">
              Meal
            </label>
            <select
              id="plan-slot"
              className={inputClass}
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
            >
              {STANDARD_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {slotLabel(s)}
                </option>
              ))}
              {customSlots
                .filter((s) => s !== otherSlot)
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              <option value={OTHER}>Other…</option>
            </select>
          </div>
          {slot === OTHER && (
            <div className="grid gap-1.5">
              <label htmlFor="plan-other" className="text-sm font-semibold">
                Meal name
              </label>
              <input
                id="plan-other"
                className={inputClass}
                maxLength={30}
                value={otherSlot}
                onChange={(e) => setOtherSlot(e.target.value)}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <label htmlFor="plan-servings" className="text-sm font-semibold">
              Servings
            </label>
            <input
              id="plan-servings"
              inputMode="numeric"
              className={inputClass}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>
        </div>

        {!editing && (
          <div className="grid gap-2 rounded-2xl border border-line p-3">
            <label htmlFor="plan-repeat" className="flex items-center gap-2 text-sm font-semibold">
              <Repeat aria-hidden className="size-4" /> Repeat
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                id="plan-repeat"
                className={inputClass}
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as typeof repeat)}
              >
                <option value="none">Does not repeat</option>
                <option value="day">Every day</option>
                <option value="week">Every week</option>
              </select>
              {repeat !== 'none' && (
                <input
                  aria-label="Number of extra repeats"
                  inputMode="numeric"
                  className={inputClass}
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(e.target.value)}
                />
              )}
            </div>
            {repeat !== 'none' && (
              <p className="text-sm text-ink-soft">
                Adds {repeatCount || '0'} more {repeat === 'day' ? 'days' : 'weeks'} after the
                first. Each is a normal entry you can change.
              </p>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-bad-soft px-4 py-2 text-sm font-medium text-bad"
          >
            {error}
          </p>
        )}

        {editing && (
          <div className="grid gap-2 rounded-2xl border border-line p-3">
            <p className="text-sm font-semibold">Move or copy</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => void shiftDay(-1)}>
                <ChevronLeft aria-hidden className="size-4" /> Previous day
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void shiftDay(1)}>
                Next day <ChevronRight aria-hidden className="size-4" />
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(() => planner.reorder(entry.id, -1), 'Moved earlier in this meal')
                }
              >
                <ArrowUp aria-hidden className="size-4" /> Earlier in this meal
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(() => planner.reorder(entry.id, 1), 'Moved later in this meal')
                }
              >
                <ArrowDown aria-hidden className="size-4" /> Later in this meal
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => planner.duplicateEntry(entry.id, { date, slot: finalSlot }),
                    'Copied to the chosen date and meal',
                  )
                }
              >
                <Copy aria-hidden className="size-4" /> Duplicate to date and meal above
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          {editing ? (
            confirmDelete ? (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  void run(() => planner.removeEntry(entry.id), 'Removed from your plan')
                }
              >
                Yes, remove
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden className="size-4" /> Remove
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {editing ? 'Save' : 'Add to plan'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
