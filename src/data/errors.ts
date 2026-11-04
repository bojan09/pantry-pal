import { InventoryError } from './inventory';

/**
 * One place that turns a thrown error into words a person can act on. Browser storage can run
 * out or be blocked (private windows, low disk), and the app should say so plainly.
 */
export function errorMessage(
  e: unknown,
  fallback = 'Something went wrong. Nothing was changed.',
): string {
  if (e instanceof InventoryError) return e.message;
  const name = (e as { name?: string } | null)?.name ?? '';
  const inner = (e as { inner?: { name?: string } } | null)?.inner?.name ?? '';
  if (
    name === 'QuotaExceededError' ||
    inner === 'QuotaExceededError' ||
    /quota/i.test(String((e as Error)?.message))
  )
    return 'Your device is out of storage space for PantryPal. Free up some space or remove large photos, then try again. Nothing was changed.';
  if (
    name === 'DatabaseClosedError' ||
    name === 'OpenFailedError' ||
    name === 'SecurityError' ||
    inner === 'SecurityError'
  )
    return 'Your browser is blocking local storage (private mode or a privacy setting). PantryPal cannot save anything until that is allowed.';
  if (name === 'VersionError')
    return 'This data was saved by a newer version of PantryPal. Reload the page to update.';
  return e instanceof Error && e.message ? `${fallback} (${e.message})` : fallback;
}
