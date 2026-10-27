import { describe, expect, it } from 'vitest';
import { addDays, greetingFor, startOfWeek, toISODate, weekDays } from './dates';

describe('dates', () => {
  it('formats local ISO dates with padding', () => {
    expect(toISODate(new Date(2025, 0, 5))).toBe('2025-01-05');
  });

  it('finds the Monday-start week across a month boundary', () => {
    // Wed 2025-10-01
    expect(toISODate(startOfWeek(new Date(2025, 9, 1), 'monday'))).toBe('2025-09-29');
  });

  it('finds the Sunday-start week', () => {
    expect(toISODate(startOfWeek(new Date(2025, 9, 1), 'sunday'))).toBe('2025-09-28');
    // A Sunday is its own week start
    expect(toISODate(startOfWeek(new Date(2025, 9, 5), 'sunday'))).toBe('2025-10-05');
  });

  it('returns seven consecutive days', () => {
    const days = weekDays(new Date(2025, 9, 20), 'monday').map(toISODate);
    expect(days[0]).toBe('2025-10-20');
    expect(days[6]).toBe('2025-10-26');
  });

  it('adds days across DST-free local arithmetic', () => {
    expect(toISODate(addDays(new Date(2025, 11, 31), 1))).toBe('2026-01-01');
  });

  it('picks a greeting by hour', () => {
    expect(greetingFor(new Date(2025, 0, 1, 8))).toBe('morning');
    expect(greetingFor(new Date(2025, 0, 1, 12))).toBe('afternoon');
    expect(greetingFor(new Date(2025, 0, 1, 18))).toBe('evening');
  });
});
