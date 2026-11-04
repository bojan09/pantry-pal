const LAST = 'pantrypal.lastBackup';
const SNOOZE = 'pantrypal.backupSnooze';

function read(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function write(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* blocked: the reminder simply repeats */
  }
}

export const lastBackupAt = (): number | null => {
  const v = read(LAST);
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};
export const markBackedUp = () => write(LAST, new Date().toISOString());
export const snoozeBackupReminder = (days = 7) =>
  write(SNOOZE, new Date(Date.now() + days * 86_400_000).toISOString());
export const backupSnoozedUntil = (): number => {
  const t = Date.parse(read(SNOOZE) ?? '');
  return Number.isFinite(t) ? t : 0;
};
/** True when there is something worth saving and no backup in the last `days` days. */
export function backupDue(hasData: boolean, now: number, days = 30): boolean {
  if (!hasData || now < backupSnoozedUntil()) return false;
  const last = lastBackupAt();
  return last == null || now - last > days * 86_400_000;
}
