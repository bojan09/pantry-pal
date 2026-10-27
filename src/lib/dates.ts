export type WeekStart = 'monday' | 'sunday';

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** The first day of the week containing `d`, at local midnight. */
export function startOfWeek(d: Date, weekStart: WeekStart): Date {
  const dow = d.getDay(); // 0 = Sunday
  const offset = weekStart === 'monday' ? (dow + 6) % 7 : dow;
  return addDays(d, -offset);
}

export function weekDays(d: Date, weekStart: WeekStart): Date[] {
  const start = startOfWeek(d, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function greetingFor(d: Date): 'morning' | 'afternoon' | 'evening' {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
