import { useMemo } from 'react';
import type { InventoryLot } from '@/data/types';
import { byFirstExpiring, dateLabelText, planConsume } from '@/domain/lots';
import { convert, formatQuantity, tidy } from '@/domain/units';
import { Button, inputClass } from '@/design/ui';

export type LotEdits = Record<string, string>;

const zoneName = (l: InventoryLot) =>
  l.zone === 'custom'
    ? (l.customZoneName ?? 'Other place')
    : l.zone[0].toUpperCase() + l.zone.slice(1);

/** The amounts, in the row's unit, that "earliest date first" would take from each lot. */
export function suggestedEdits(
  lots: InventoryLot[],
  quantity: number,
  unit: string,
  density?: number,
): LotEdits {
  const out: LotEdits = {};
  const plan = planConsume(lots, quantity, unit, density);
  if (!plan.ok) return out;
  for (const s of plan.steps) {
    const lot = lots.find((l) => l.id === s.lotId)!;
    const q = convert(s.take, lot.unit, unit, density);
    if (q != null) out[s.lotId] = String(tidy(q));
  }
  return out;
}

export const sumEdits = (e: LotEdits): number =>
  tidy(Object.values(e).reduce((s, v) => s + (Number(v.replace(',', '.')) || 0), 0));

/** Lets the cook decide exactly which lots were used (e.g. the new jar, not the opened one). */
export function LotPicker({
  name,
  lots,
  unit,
  density,
  quantity,
  edits,
  onEdits,
  onReset,
}: {
  name: string;
  lots: InventoryLot[];
  unit: string;
  density?: number;
  quantity: number;
  edits?: LotEdits;
  onEdits: (e: LotEdits) => void;
  onReset: () => void;
}) {
  const sorted = useMemo(() => [...lots].sort(byFirstExpiring), [lots]);
  const shown = edits ?? suggestedEdits(sorted, quantity, unit, density);
  return (
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-accent-text">
        Choose which lots {edits ? '(custom)' : ''}
      </summary>
      <ul className="grid gap-2" aria-label={`${name} lots`}>
        {sorted.map((l, i) => {
          const avail = convert(l.quantity, l.unit, unit, density);
          if (avail == null) return null;
          return (
            <li key={l.id} className="grid grid-cols-[1fr_6.5rem] items-center gap-2">
              <label htmlFor={`lot-${l.id}`}>
                <span className="font-medium">
                  {zoneName(l)}
                  {i === 0 ? ' · earliest' : ''}
                </span>
                <span className="block text-ink-soft">
                  {formatQuantity(l.quantity, l.unit)}
                  {l.date ? ` · ${dateLabelText(l.dateLabel)} ${l.date}` : ' · no date'}
                </span>
              </label>
              <input
                id={`lot-${l.id}`}
                aria-label={`${name}: amount from ${zoneName(l)} lot ${i + 1}`}
                inputMode="decimal"
                className={inputClass}
                value={shown[l.id] ?? ''}
                placeholder="0"
                onChange={(e) => onEdits({ ...shown, [l.id]: e.target.value })}
              />
            </li>
          );
        })}
      </ul>
      {edits && (
        <Button variant="ghost" className="mt-1" onClick={onReset}>
          Back to earliest first
        </Button>
      )}
    </details>
  );
}
