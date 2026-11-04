import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@/data/errors';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, m } from 'motion/react';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Pause,
  Play,
  ListChecks,
  Star,
  Timer,
  X,
} from 'lucide-react';
import { db } from '@/data/db';
import { recipes as repo } from '@/data/recipes';
import type { CookingSession } from '@/data/types';
import { Tomato } from '@/design/illustrations';
import {
  Button,
  Card,
  cx,
  Dialog,
  EmptyState,
  inputClass,
  LinkButton,
  PageHeader,
} from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import {
  groupLots,
  proposeDeductions,
  recipeAvailability,
  type DeductionRow,
} from '@/domain/recipes';
import { planConsume } from '@/domain/lots';
import { clampServings, formatAmount } from '@/domain/scaling';
import { formatClock, isFinished, isPaused, remainingMs } from '@/domain/timers';
import { convert, formatQuantity, tidy, UNITS, unitsForSystem } from '@/domain/units';
import { ConfirmDialog } from '../pantry/dialogs';
import { RecipeArt } from './RecipeArt';
import { chime, notifyTimerDone, primeAudio, useWakeLock } from './cookingUtils';
import { CookedFlourish, useFlourishDelay } from './CookedFlourish';
import { LotPicker, sumEdits, type LotEdits } from './LotPicker';
import { useNow, useRecipeDetail, type RecipeDetail } from './hooks';

const errMsg = (e: unknown) => errorMessage(e, 'Something went wrong');

/* ------------------------------------------------------------------ */
/* Finish: confirm what was used                                       */
/* ------------------------------------------------------------------ */

interface Row extends DeductionRow {
  qtyText: string;
  /** set once the cook picks lots by hand: amounts in the row's unit per lot id */
  lotEdits?: LotEdits;
}

function FinishDialog({
  planEntryId,
  session,
  detail,
  factor,
  onClose,
  onDone,
}: {
  planEntryId?: string;
  session: CookingSession;
  detail: RecipeDetail;
  factor: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { prefs } = usePrefs();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() =>
    proposeDeductions(
      recipeAvailability(detail.lines, factor, groupLots(detail.lots), detail.ingredients),
    ).map((r) => ({ ...r, qtyText: String(r.quantity) })),
  );
  const [rating, setRating] = useState<number>();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const lotsBy = useMemo(() => groupLots(detail.lots), [detail.lots]);
  const unitOptions = unitsForSystem(prefs.units);

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (i === j ? { ...r, ...p } : r)));

  // Check each ticked row against current stock so errors show before anything is applied.
  const checks = rows.map((r) => {
    if (!r.include) return { ok: true as const };
    const ing = detail.ingredients.get(r.ingredientId);
    const lots = lotsBy.get(r.ingredientId) ?? [];
    if (r.lotEdits) {
      let total = 0;
      let used = 0;
      for (const l of lots) {
        const raw = (r.lotEdits[l.id] ?? '').trim();
        if (!raw) continue;
        const n = Number(raw.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0)
          return { ok: false as const, msg: 'Lot amounts must be numbers of 0 or more' };
        if (n === 0) continue;
        const take = convert(n, r.unit, l.unit, ing?.densityGPerMl);
        if (take == null) return { ok: false as const, msg: 'Pick a unit that fits that lot' };
        if (take > l.quantity + 1e-9)
          return {
            ok: false as const,
            msg: `Only ${formatQuantity(l.quantity, l.unit)} in that lot`,
          };
        total += n;
        used++;
      }
      if (!(total > 0)) return { ok: false as const, msg: 'Enter an amount from at least one lot' };
      return { ok: true as const, lots: used, q: total };
    }
    const q = Number(r.qtyText.replace(',', '.'));
    const plan = planConsume(lots, q, r.unit, ing?.densityGPerMl);
    if (plan.ok) return { ok: true as const, lots: plan.steps.length, q };
    const msg = {
      invalid: 'Enter an amount above 0',
      incompatible: 'Your stock cannot be measured in this unit. Pick another unit.',
      insufficient: `Only ${formatQuantity(plan.available ?? 0, r.unit)} on hand`,
    }[plan.reason];
    return { ok: false as const, msg };
  });
  const allOk = checks.every((c) => c.ok);
  const ticked = rows.filter((r) => r.include).length;

  async function confirm(applyStock: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      const chosen = applyStock
        ? rows
            .filter((r) => r.include)
            .map((r) => {
              const density = detail.ingredients.get(r.ingredientId)?.densityGPerMl;
              const lots = r.lotEdits
                ? (lotsBy.get(r.ingredientId) ?? []).flatMap((l) => {
                    const n = Number((r.lotEdits![l.id] ?? '').replace(',', '.'));
                    const take = n > 0 ? convert(n, r.unit, l.unit, density) : null;
                    return take != null && take > 0 ? [{ lotId: l.id, take: tidy(take) }] : [];
                  })
                : undefined;
              return {
                ingredientId: r.ingredientId,
                quantity: r.lotEdits ? sumEdits(r.lotEdits) : Number(r.qtyText.replace(',', '.')),
                unit: r.unit,
                ...(lots ? { lots } : {}),
              };
            })
        : [];
      await repo.finishCooking(session.id, chosen, { rating, notes, planEntryId });
      toast({
        message: applyStock
          ? `Pantry updated for ${chosen.length} ingredient${chosen.length === 1 ? '' : 's'}`
          : 'Marked as cooked. Pantry unchanged.',
      });
      onDone();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Update your pantry?">
      <div className="grid gap-4">
        <p className="text-sm text-ink-soft">
          Nothing is deducted until you confirm. Adjust amounts to what you really used, or untick
          anything you did not use.
        </p>
        <ul className="grid max-h-[40vh] gap-2 overflow-y-auto pr-1" aria-label="Ingredients used">
          {rows.map((r, i) => {
            const ing = detail.ingredients.get(r.ingredientId);
            const c = checks[i];
            const name = ing?.name ?? 'Ingredient';
            return (
              <li key={i} className="grid gap-2 rounded-2xl bg-surface-2 p-3">
                <label className="flex min-h-11 items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--color-accent)]"
                    checked={r.include}
                    onChange={(e) => patch(i, { include: e.target.checked })}
                  />
                  {name}
                </label>
                {r.include && (
                  <div className="grid grid-cols-[1fr_8rem] gap-2">
                    <input
                      aria-label={`${name} amount used`}
                      inputMode="decimal"
                      className={inputClass}
                      value={r.qtyText}
                      onChange={(e) => patch(i, { qtyText: e.target.value, lotEdits: undefined })}
                    />
                    <select
                      aria-label={`${name} unit`}
                      className={inputClass}
                      value={r.unit}
                      onChange={(e) => patch(i, { unit: e.target.value, lotEdits: undefined })}
                    >
                      {(unitOptions.some((u) => u.id === r.unit)
                        ? unitOptions
                        : [...unitOptions, ...UNITS.filter((u) => u.id === r.unit)]
                      ).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {r.include && !c.ok && (
                  <p role="alert" className="text-sm font-medium text-bad">
                    {c.msg}
                  </p>
                )}
                {r.include && c.ok && 'lots' in c && c.lots !== undefined && (
                  <p className="text-sm text-ink-soft">
                    Uses the earliest-dated stock first
                    {c.lots > 1 ? `, across ${c.lots} lots` : ''}.
                  </p>
                )}
                {r.include && (lotsBy.get(r.ingredientId)?.length ?? 0) > 0 && (
                  <LotPicker
                    name={name}
                    lots={lotsBy.get(r.ingredientId) ?? []}
                    unit={r.unit}
                    density={ing?.densityGPerMl}
                    quantity={Number(r.qtyText.replace(',', '.')) || 0}
                    edits={r.lotEdits}
                    onEdits={(e) => patch(i, { lotEdits: e, qtyText: String(sumEdits(e)) })}
                    onReset={() => patch(i, { lotEdits: undefined })}
                  />
                )}
                {!r.include && r.note && <p className="text-sm text-ink-soft">{r.note}.</p>}
                {r.include && r.note && c.ok && <p className="text-sm text-warn">{r.note}.</p>}
              </li>
            );
          })}
        </ul>

        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-semibold">How was it? (optional)</legend>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
                onClick={() => setRating(rating === n ? undefined : n)}
                className="pp-lift grid size-11 place-items-center rounded-full"
              >
                <Star
                  aria-hidden
                  className={cx(
                    'size-6',
                    rating && n <= rating ? 'fill-saffron text-saffron' : 'text-ink-soft',
                  )}
                />
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-1.5">
          <label htmlFor="cook-notes" className="text-sm font-semibold">
            Notes for next time (optional)
          </label>
          <textarea
            id="cook-notes"
            className={inputClass + ' min-h-16 py-3'}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-bad-soft px-4 py-2 text-sm font-medium text-bad"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Back to cooking
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void confirm(false)}>
            Finish without changing pantry
          </Button>
          <Button disabled={busy || !allOk || ticked === 0} onClick={() => void confirm(true)}>
            <Check aria-hidden className="size-4" />
            Confirm and update pantry
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Timers                                                              */
/* ------------------------------------------------------------------ */

function TimersPanel({ session, now }: { session: CookingSession; now: number }) {
  const toast = useToast();
  const [minutes, setMinutes] = useState('');
  const [label, setLabel] = useState('');
  const timers = useMemo(() => session.timers ?? [], [session.timers]);
  const alerted = useRef(new Set<string>());
  const [, setTick] = useState(0);

  // Sound once per finished timer. Anything that finished while the app was closed is
  // shown as finished but not chimed again after a reload.
  useEffect(() => {
    for (const t of timers) {
      if (isFinished(t, now) && !alerted.current.has(t.id)) {
        alerted.current.add(t.id);
        if (now - t.endsAt < 5000) {
          chime();
          notifyTimerDone(t.label);
        }
      }
    }
  }, [timers, now]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(minutes.replace(',', '.'));
    if (!Number.isFinite(m) || m <= 0) {
      toast({ message: 'Enter the timer length in minutes', tone: 'error' });
      return;
    }
    primeAudio();
    try {
      await repo.startTimer(session.id, label.trim() || `${m} min timer`, m * 60);
      setMinutes('');
      setLabel('');
    } catch (er) {
      toast({ message: errMsg(er), tone: 'error' });
    }
  }

  return (
    <Card aria-labelledby="timers-h" className="grid gap-3">
      <h2 id="timers-h" className="flex items-center gap-2 text-xl font-semibold">
        <Timer aria-hidden className="size-5 text-accent-text" /> Timers
      </h2>
      {timers.length === 0 ? (
        <p className="text-sm text-ink-soft">No timers running.</p>
      ) : (
        <ul className="grid gap-2">
          {timers.map((t) => {
            const left = remainingMs(t, now);
            const done = isFinished(t, now);
            const pct = Math.min(
              100,
              ((t.durationSec * 1000 - left) / (t.durationSec * 1000)) * 100,
            );
            return (
              <li
                key={t.id}
                className={cx(
                  'grid gap-1.5 rounded-2xl p-3',
                  done ? 'bg-warn-soft text-warn' : 'bg-surface-2',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{t.label}</span>
                  {!done && (
                    <button
                      type="button"
                      aria-label={`${isPaused(t) ? 'Resume' : 'Pause'} ${t.label}`}
                      onClick={() => void repo.setTimerPaused(session.id, t.id, !isPaused(t))}
                      className="pp-lift ml-auto grid size-11 place-items-center rounded-full"
                    >
                      {isPaused(t) ? (
                        <Play aria-hidden className="size-4" />
                      ) : (
                        <Pause aria-hidden className="size-4" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`${done ? 'Dismiss' : 'Cancel'} ${t.label}`}
                    onClick={() => void repo.removeTimer(session.id, t.id)}
                    className="pp-lift grid size-11 place-items-center rounded-full"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
                {done ? (
                  <p role="alert" className="flex items-center gap-2 text-lg font-bold">
                    <Bell aria-hidden className="size-5" /> Time&apos;s up
                  </p>
                ) : (
                  <p
                    className="font-display text-3xl font-semibold tabular-nums"
                    role="timer"
                    aria-label={`${t.label}: ${formatClock(left)} left${isPaused(t) ? ', paused' : ''}`}
                  >
                    {formatClock(left)}
                    {isPaused(t) && (
                      <span className="ml-2 text-base font-sans text-ink-soft">Paused</span>
                    )}
                  </p>
                )}
                <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={add} className="grid grid-cols-[5.5rem_1fr_auto] gap-2">
        <input
          aria-label="Timer minutes"
          inputMode="decimal"
          placeholder="Min"
          className={inputClass}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <input
          aria-label="Timer label (optional)"
          placeholder="Label (optional)"
          className={inputClass}
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button type="submit" variant="soft">
          Start
        </Button>
      </form>
      {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
        <div className="grid gap-1 rounded-2xl bg-surface-2 p-3">
          <Button
            variant="ghost"
            onClick={async () => {
              await Notification.requestPermission();
              setTick((n) => n + 1);
            }}
          >
            <Bell aria-hidden className="size-4" /> Allow alerts when this tab is hidden
          </Button>
          <p className="text-xs text-ink-soft">
            Your browser will ask once. Alerts work while PantryPal is open in a tab or window (even
            in the background).
          </p>
        </div>
      )}
      <p className="text-xs text-ink-soft">
        Timers keep time even if you switch tabs or reload. Sound and alerts only work while
        PantryPal is open on this device: a web app cannot ring after it is closed.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function CookingPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { prefs } = usePrefs();
  const { loading, data } = useRecipeDetail(id);
  const [sessionId, setSessionId] = useState<string>();
  const [finishOpen, setFinishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const flourishMs = useFlourishDelay();
  const [dir, setDir] = useState<1 | -1>(1);
  const [showIngredients, setShowIngredients] = useState(false);
  const started = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const recipe = data?.recipe;
  const requested = Number(params.get('servings')) || undefined;

  // Resume or create the single active session for this recipe.
  useEffect(() => {
    if (!recipe || started.current) return;
    started.current = true;
    repo
      .startCooking(recipe.id, clampServings(requested ?? recipe.servings))
      .then((s) => setSessionId(s.id))
      .catch((e: unknown) => toast({ message: errMsg(e), tone: 'error' }));
  }, [recipe, requested, toast]);

  const session = useLiveQuery(
    () => (sessionId ? db.cookingSessions.get(sessionId) : undefined),
    [sessionId],
  );
  const active = session?.status === 'active';
  const now = useNow(active && (session?.timers ?? []).some((t) => !isPaused(t)));
  const wake = useWakeLock(!!active);

  const step = Math.min(session?.stepIndex ?? 0, Math.max(0, (data?.steps.length ?? 1) - 1));
  const total = data?.steps.length ?? 0;
  const factor = recipe && session ? session.servings / recipe.servings : 1;

  const go = (to: number) => {
    if (!session || !data) return;
    const next = Math.max(0, Math.min(total - 1, to));
    if (next === step) return;
    setDir(next > step ? 1 : -1);
    const checked = new Set(session.checkedSteps ?? []);
    if (next > step) checked.add(step);
    void repo.patchSession(session.id, { stepIndex: next, checkedSteps: [...checked] });
  };

  // Keyboard: ← / → move between steps unless the user is typing or a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finishOpen || cancelOpen || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'ArrowRight') go(step + 1);
      if (e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading) return <PageHeader title="Cooking" back="/recipes" />;
  if (!data || !recipe) {
    return (
      <>
        <PageHeader title="Cooking" back="/recipes" />
        <Card>
          <EmptyState
            art={<Tomato />}
            title="Recipe not found"
            body="It may have been deleted."
            action={<LinkButton to="/recipes">Back to recipes</LinkButton>}
          />
        </Card>
      </>
    );
  }
  if (!session)
    return <PageHeader title={`Cooking ${recipe.name}`} back={`/recipes/${recipe.id}`} />;

  // The session turns "completed" the moment it is saved, so the flourish must be shown
  // before the generic "all done" screen would replace this page.
  if (celebrating) {
    return (
      <CookedFlourish
        name={recipe.name}
        ms={flourishMs}
        onDone={() => navigate(`/recipes/${recipe.id}`, { replace: true })}
      />
    );
  }

  if (session.status !== 'active') {
    return (
      <>
        <PageHeader title={recipe.name} back={`/recipes/${recipe.id}`} />
        <Card>
          <EmptyState
            art={<Tomato />}
            title={session.status === 'completed' ? 'All done' : 'Cooking stopped'}
            body={
              session.status === 'completed'
                ? 'This session is finished and saved in your cooking history.'
                : 'This session was cancelled. Nothing in your pantry changed.'
            }
            action={<LinkButton to={`/recipes/${recipe.id}`}>Back to recipe</LinkButton>}
          />
        </Card>
      </>
    );
  }

  const s = data.steps[step];
  const checkedIng = new Set(session.checkedIngredients ?? []);
  const isLast = step === total - 1;
  const stepTimerLabel = `Step ${step + 1}`;
  const stepTimerRunning = (session.timers ?? []).some(
    (t) => t.label === stepTimerLabel && !t.dismissed,
  );

  return (
    <>
      <PageHeader
        title={recipe.name}
        subtitle={`Cooking for ${session.servings} ${session.servings === 1 ? 'serving' : 'servings'}`}
        back={`/recipes/${recipe.id}`}
        actions={
          <Button variant="ghost" onClick={() => setCancelOpen(true)}>
            Stop cooking
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid min-w-0 content-start gap-4">
          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Cooking progress"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={step + 1}
              aria-valuetext={`Step ${step + 1} of ${total}`}
              className="h-2 flex-1 overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${((step + 1) / total) * 100}%` }}
              />
            </div>
            <p className="text-sm font-semibold tabular-nums">
              Step {step + 1} of {total}
            </p>
          </div>

          <div
            className="pp-card relative touch-pan-y overflow-hidden p-0"
            onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
            onPointerUp={(e) => {
              const st = swipe.current;
              swipe.current = null;
              if (!st) return;
              const dx = e.clientX - st.x;
              const dy = e.clientY - st.y;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
                go(step + (dx < 0 ? 1 : -1));
            }}
            onPointerCancel={() => (swipe.current = null)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={step}
                initial={{ opacity: 0, x: 28 * dir }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 * dir }}
                transition={{ duration: 0.18 }}
                className="grid gap-5 p-6 sm:p-8"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-12 place-items-center rounded-full bg-accent font-display text-2xl font-semibold text-accent-ink"
                  >
                    {step + 1}
                  </span>
                  <h2 className="text-xl font-semibold text-ink-soft">Step {step + 1}</h2>
                </div>
                <p className="font-display text-2xl leading-snug sm:text-3xl" aria-live="polite">
                  {s.text}
                </p>
                {s.timerSeconds && (
                  <div>
                    <Button
                      variant="soft"
                      disabled={stepTimerRunning}
                      onClick={async () => {
                        primeAudio();
                        try {
                          await repo.startTimer(session.id, stepTimerLabel, s.timerSeconds!);
                        } catch (e) {
                          toast({ message: errMsg(e), tone: 'error' });
                        }
                      }}
                    >
                      <Timer aria-hidden className="size-4" />
                      {stepTimerRunning
                        ? 'Timer running'
                        : `Start ${Math.round(s.timerSeconds / 60)} min timer`}
                    </Button>
                    {factor !== 1 && (
                      <p className="mt-1 text-sm text-ink-soft">
                        Timing is for {recipe.servings} servings and may differ at this size.
                      </p>
                    )}
                  </div>
                )}
              </m.div>
            </AnimatePresence>
            <div className="grid grid-cols-2 gap-3 border-t border-line p-4">
              <Button
                variant="ghost"
                className="min-h-14"
                disabled={step === 0}
                onClick={() => go(step - 1)}
              >
                <ChevronLeft aria-hidden className="size-5" /> Back
              </Button>
              {isLast ? (
                <Button className="min-h-14" onClick={() => setFinishOpen(true)}>
                  <Flame aria-hidden className="size-5" /> Finish cooking
                </Button>
              ) : (
                <Button className="min-h-14" onClick={() => go(step + 1)}>
                  Next <ChevronRight aria-hidden className="size-5" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-ink-soft">
            Swipe the card, tap Next/Back, or use the ← → keys.
            {wake === 'on' && ' Your screen will stay on while you cook.'}
            {wake === 'unsupported' && ' This browser cannot keep the screen awake, so it may dim.'}
          </p>
          <ol className="flex flex-wrap gap-2" aria-label="Jump to step">
            {data.steps.map((_, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-label={`Go to step ${i + 1}`}
                  aria-current={i === step ? 'step' : undefined}
                  onClick={() => go(i)}
                  className={cx(
                    'pp-lift grid size-11 place-items-center rounded-full border text-sm font-semibold',
                    i === step
                      ? 'border-transparent bg-accent text-accent-ink'
                      : (session.checkedSteps ?? []).includes(i)
                        ? 'border-line bg-good-soft text-good'
                        : 'border-line bg-surface',
                  )}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <TimersPanel session={session} now={now} />
          <Card aria-labelledby="chk-h" className="grid gap-2">
            <button
              type="button"
              className="flex min-h-11 items-center justify-between gap-2 text-left lg:pointer-events-none"
              aria-expanded={showIngredients}
              onClick={() => setShowIngredients((v) => !v)}
            >
              <h2 id="chk-h" className="flex items-center gap-2 text-xl font-semibold">
                <ListChecks aria-hidden className="size-5 text-accent-text" /> Ingredients
              </h2>
              <span className="text-sm text-ink-soft lg:hidden">
                {checkedIng.size}/{data.lines.length} ready · {showIngredients ? 'Hide' : 'Show'}
              </span>
            </button>
            <ul className={cx('grid gap-0.5', !showIngredients && 'hidden lg:grid')}>
              {data.lines.map((l) => {
                const ing = data.ingredients.get(l.ingredientId);
                const on = checkedIng.has(l.id);
                return (
                  <li key={l.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                      <input
                        type="checkbox"
                        className="size-5 accent-[var(--color-accent)]"
                        checked={on}
                        onChange={(e) => {
                          const next = new Set(checkedIng);
                          if (e.target.checked) next.add(l.id);
                          else next.delete(l.id);
                          void repo.patchSession(session.id, { checkedIngredients: [...next] });
                        }}
                      />
                      <span className={cx(on && 'text-ink-soft line-through')}>
                        <span className="font-semibold tabular-nums">
                          {formatAmount(l.quantity * factor, l.unit, prefs.units)}
                        </span>{' '}
                        {ing?.name}
                        {l.optional && ' (optional)'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>
          <RecipeArt
            recipe={recipe}
            className="hidden aspect-[16/9] rounded-3xl border border-line lg:grid"
          />
        </div>
      </div>

      {finishOpen && (
        <FinishDialog
          planEntryId={params.get('plan') ?? undefined}
          session={session}
          detail={data}
          factor={factor}
          onClose={() => setFinishOpen(false)}
          onDone={() => {
            setFinishOpen(false);
            if (flourishMs === 0) navigate(`/recipes/${recipe.id}`, { replace: true });
            else setCelebrating(true);
          }}
        />
      )}
      {cancelOpen && (
        <ConfirmDialog
          title="Stop cooking?"
          confirmLabel="Stop cooking"
          danger
          onClose={() => setCancelOpen(false)}
          onConfirm={async () => {
            try {
              await repo.cancelCooking(session.id);
              toast({ message: 'Stopped. Your pantry was not changed.' });
              navigate(`/recipes/${recipe.id}`, { replace: true });
            } catch (e) {
              toast({ message: errMsg(e), tone: 'error' });
            }
          }}
        >
          <p>Your timers and progress will be discarded. Nothing in your pantry changes.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
