import { describe, expect, it } from 'vitest';
import { formatClock, isFinished, makeTimer, pauseTimer, remainingMs, resumeTimer } from './timers';

describe('timers', () => {
  const t = makeTimer('a', 'Pasta', 600, 1_000_000);
  it('derives remaining time from the end timestamp', () => {
    expect(remainingMs(t, 1_000_000)).toBe(600_000);
    expect(remainingMs(t, 1_300_000)).toBe(300_000);
    expect(remainingMs(t, 9_000_000)).toBe(0);
    expect(isFinished(t, 1_599_999)).toBe(false);
    expect(isFinished(t, 1_600_000)).toBe(true);
  });
  it('pause freezes the time left and resume continues from it', () => {
    const p = pauseTimer(t, 1_200_000);
    expect(remainingMs(p, 1_200_000)).toBe(400_000);
    expect(remainingMs(p, 5_000_000)).toBe(400_000); // time passing does not change it
    expect(isFinished(p, 99_000_000)).toBe(false);
    const r = resumeTimer(p, 5_000_000);
    expect(r.pausedRemainingMs).toBeUndefined();
    expect(remainingMs(r, 5_000_000)).toBe(400_000);
    expect(remainingMs(r, 5_100_000)).toBe(300_000);
  });
  it('ignores pausing a finished or paused timer and resuming a running one', () => {
    expect(pauseTimer(t, 2_000_000)).toBe(t);
    const p = pauseTimer(t, 1_100_000);
    expect(pauseTimer(p, 1_200_000)).toBe(p);
    expect(resumeTimer(t, 1_100_000)).toBe(t);
  });
  it('formats clocks', () => {
    expect(formatClock(75_000)).toBe('1:15');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(0)).toBe('0:00');
  });
});
