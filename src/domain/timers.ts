import type { CookingTimer } from '@/data/types';

/** Remaining time derives from a stored end timestamp, so it survives refresh and tab sleep. */
type T = Pick<CookingTimer, 'endsAt' | 'pausedRemainingMs'>;

export const isPaused = (t: Pick<CookingTimer, 'pausedRemainingMs'>): boolean =>
  t.pausedRemainingMs != null;

export const remainingMs = (t: T, now: number): number =>
  t.pausedRemainingMs != null ? t.pausedRemainingMs : Math.max(0, t.endsAt - now);

export const isFinished = (t: T, now: number): boolean => !isPaused(t) && now >= t.endsAt;

/** Freezes a running timer. Pausing a paused or finished timer changes nothing. */
export function pauseTimer(t: CookingTimer, now: number): CookingTimer {
  if (isPaused(t) || now >= t.endsAt) return t;
  return { ...t, pausedRemainingMs: t.endsAt - now };
}

/** Continues a paused timer from where it stopped. */
export function resumeTimer(t: CookingTimer, now: number): CookingTimer {
  if (t.pausedRemainingMs == null) return t;
  const { pausedRemainingMs, ...rest } = t;
  return { ...rest, endsAt: now + pausedRemainingMs };
}

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function makeTimer(
  id: string,
  label: string,
  durationSec: number,
  now: number,
): CookingTimer {
  return { id, label, durationSec, startedAt: now, endsAt: now + durationSec * 1000 };
}
