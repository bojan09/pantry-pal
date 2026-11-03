import type { Amount, ExpiryStatus } from '@/domain/lots';
import { formatBase } from '@/domain/units';
import type { StorageZone } from '@/data/types';

export function formatAmount(a: Amount, system: 'metric' | 'imperial'): string {
  if (a.dimension === 'count') return `${Number(a.base.toFixed(3))} ${a.unit}`;
  return formatBase(a.base, a.dimension, system);
}

/** "1.5 kg + 3 pcs": amounts in incompatible units are listed, never merged. */
export const formatTotals = (totals: Amount[], system: 'metric' | 'imperial'): string =>
  totals.length ? totals.map((t) => formatAmount(t, system)).join(' + ') : 'None';

export const ZONE_LABEL: Record<StorageZone, string> = {
  pantry: 'Pantry',
  fridge: 'Fridge',
  freezer: 'Freezer',
  custom: 'Other',
};

export const zoneName = (z: StorageZone, custom?: string) =>
  z === 'custom' && custom ? custom : ZONE_LABEL[z];

export const STATUS_CLASS: Record<ExpiryStatus, string> = {
  expired: 'bg-bad-soft text-bad',
  soon: 'bg-warn-soft text-warn',
  ok: 'bg-good-soft text-good',
  none: 'bg-surface-2 text-ink-soft',
};
export const STATUS_WORD: Record<ExpiryStatus, string> = {
  expired: 'Past date',
  soon: 'Expiring soon',
  ok: 'OK',
  none: 'No date',
};
