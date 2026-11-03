import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { shopping, type StockRow } from '@/data/shopping';
import type { Ingredient, ShoppingItem } from '@/data/types';
import { Button, Dialog, inputClass } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { UNITS, unitsForSystem } from '@/domain/units';

interface Row {
  item: ShoppingItem;
  include: boolean;
  ingredientName: string;
  qty: string;
  unit: string;
  zone: StockRow['zone'];
  dateLabel: StockRow['dateLabel'];
  date: string;
}

const zoneFor = (i?: Ingredient): StockRow['zone'] =>
  i?.category === 'Frozen'
    ? 'freezer'
    : i && ['Dairy & Eggs', 'Meat & Fish'].includes(i.category)
      ? 'fridge'
      : 'pantry';

/** Confirms amount, place and date for ticked items before any of them become stock. */
export function StockDialog({ items, onClose }: { items: ShoppingItem[]; onClose: () => void }) {
  const { prefs } = usePrefs();
  const toast = useToast();
  const ingredients = useLiveQuery(
    () => db.ingredients.orderBy('name').toArray(),
    [],
    [] as Ingredient[],
  );
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Initialise once ingredients have loaded.
  if (!rows && ingredients.length) {
    const byId = new Map(ingredients.map((i) => [i.id, i]));
    setRows(
      items.map((item) => {
        const ing = item.ingredientId ? byId.get(item.ingredientId) : undefined;
        return {
          item,
          include: !!ing,
          ingredientName: ing?.name ?? item.name,
          qty: item.quantity ? String(item.quantity) : '',
          unit: item.unit ?? ing?.defaultUnit ?? 'pcs',
          zone: zoneFor(ing),
          dateLabel: 'unknown',
          date: '',
        };
      }),
    );
  }

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => rs!.map((r, j) => (i === j ? { ...r, ...p } : r)));
  const units = unitsForSystem(prefs.units);
  const resolve = (name: string) =>
    ingredients.find(
      (i) =>
        i.name.toLowerCase() === name.trim().toLowerCase() ||
        i.aliases.some((a) => a.toLowerCase() === name.trim().toLowerCase()),
    );

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      const out: StockRow[] = [];
      for (const r of rows!.filter((x) => x.include)) {
        const ing = resolve(r.ingredientName);
        if (!ing)
          throw new Error(
            `"${r.ingredientName}" is not in your ingredient list. Pick one from the list or untick it.`,
          );
        const q = Number(r.qty.replace(',', '.'));
        if (!Number.isFinite(q) || q <= 0)
          throw new Error(`Enter the amount you bought for ${ing.name}`);
        out.push({
          itemId: r.item.id,
          ingredientId: ing.id,
          quantity: q,
          unit: r.unit,
          zone: r.zone,
          dateLabel: r.dateLabel,
          date: r.dateLabel === 'unknown' ? undefined : r.date,
        });
      }
      await shopping.stockPurchased(out);
      toast({
        message: `Added ${out.length} purchase${out.length === 1 ? '' : 's'} to your pantry`,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the pantry');
      setBusy(false);
    }
  }

  const chosen = rows?.filter((r) => r.include).length ?? 0;
  return (
    <Dialog open onClose={onClose} title="Add purchases to your pantry">
      <div className="grid gap-4">
        <p className="text-sm text-ink-soft">
          Confirm what you actually bought and where it goes. Nothing is added until you press the
          button.
        </p>
        <datalist id="stock-ings">
          {ingredients.map((i) => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>
        <ul className="grid max-h-[45vh] gap-3 overflow-y-auto pr-1" aria-label="Purchases">
          {rows?.map((r, i) => (
            <li key={r.item.id} className="grid gap-2 rounded-2xl bg-surface-2 p-3">
              <label className="flex min-h-11 items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--color-accent)]"
                  checked={r.include}
                  onChange={(e) => patch(i, { include: e.target.checked })}
                />
                {r.item.name}
              </label>
              {r.include && (
                <div className="grid grid-cols-2 gap-2">
                  {!r.item.ingredientId && (
                    <input
                      aria-label={`${r.item.name}: ingredient`}
                      list="stock-ings"
                      placeholder="Which ingredient?"
                      className={inputClass + ' col-span-2'}
                      value={r.ingredientName}
                      onChange={(e) => patch(i, { ingredientName: e.target.value })}
                    />
                  )}
                  <input
                    aria-label={`${r.item.name}: amount bought`}
                    inputMode="decimal"
                    className={inputClass}
                    value={r.qty}
                    onChange={(e) => patch(i, { qty: e.target.value })}
                  />
                  <select
                    aria-label={`${r.item.name}: unit`}
                    className={inputClass}
                    value={r.unit}
                    onChange={(e) => patch(i, { unit: e.target.value })}
                  >
                    {(units.some((u) => u.id === r.unit)
                      ? units
                      : [...units, ...UNITS.filter((u) => u.id === r.unit)]
                    ).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`${r.item.name}: store in`}
                    className={inputClass}
                    value={r.zone}
                    onChange={(e) => patch(i, { zone: e.target.value as Row['zone'] })}
                  >
                    <option value="pantry">Pantry</option>
                    <option value="fridge">Fridge</option>
                    <option value="freezer">Freezer</option>
                  </select>
                  <select
                    aria-label={`${r.item.name}: date on package`}
                    className={inputClass}
                    value={r.dateLabel}
                    onChange={(e) => patch(i, { dateLabel: e.target.value as Row['dateLabel'] })}
                  >
                    <option value="unknown">No date</option>
                    <option value="best_before">Best before</option>
                    <option value="use_by">Use by</option>
                  </select>
                  {r.dateLabel !== 'unknown' && (
                    <input
                      aria-label={`${r.item.name}: date`}
                      type="date"
                      className={inputClass + ' col-span-2'}
                      value={r.date}
                      onChange={(e) => patch(i, { date: e.target.value })}
                    />
                  )}
                </div>
              )}
              {!r.include && !r.item.ingredientId && (
                <p className="text-sm text-ink-soft">
                  Tick it and choose an ingredient to track it.
                </p>
              )}
            </li>
          ))}
        </ul>
        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-bad-soft px-4 py-2 text-sm font-medium text-bad"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || chosen === 0} onClick={() => void confirm()}>
            Add {chosen} to pantry
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
