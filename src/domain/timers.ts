import type { CookingTimer } from '@/data/types';

/** Remaining time derives from a stored end timestamp, so it survives refresh and tab sleep. */
export const remainingMs = (t: Pick<CookingTimer, 'endsAt'>, now: number): number =>
  Math.max(0, t.endsAt - now);

export const isFinished = (t: Pick<CookingTimer, 'endsAt'>, now: number): boolean =>
  now >= t.endsAt;

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
