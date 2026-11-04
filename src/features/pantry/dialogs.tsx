import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '@/data/errors';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Search } from 'lucide-react';
import { db } from '@/data/db';
import { CATEGORIES } from '@/data/catalog';
import { inventory, lotInputSchema, type LotInput } from '@/data/inventory';
import type { Ingredient, InventoryLot, StorageZone } from '@/data/types';
import { totalsFor } from '@/domain/lots';
import { UNITS, unitLabel, unitsForSystem } from '@/domain/units';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { Button, Dialog, Field, inputClass, Segmented } from '@/design/ui';
import { formatQuantity } from '@/domain/units';
import { formatTotals, ZONE_LABEL } from './format';

const ZONE_OPTIONS: { value: StorageZone; label: string }[] = [
  { value: 'pantry', label: 'Pantry' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'custom', label: 'Other place' },
];

function useUnitOptions(extra?: string) {
  const { prefs } = usePrefs();
  return useMemo(() => {
    const list = unitsForSystem(prefs.units);
    const withExtra =
      extra && !list.some((u) => u.id === extra)
        ? [...list, ...UNITS.filter((u) => u.id === extra)]
        : list;
    return withExtra;
  }, [prefs.units, extra]);
}

function UnitSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = useUnitOptions(value);
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((u) => (
        <option key={u.id} value={u.id}>
          {u.label}
        </option>
      ))}
    </select>
  );
}

const ErrorText = ({ id, msg }: { id: string; msg?: string }) =>
  msg ? (
    <p id={id} role="alert" className="text-sm font-medium text-bad">
      {msg}
    </p>
  ) : null;

const num = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s));

function FormActions({
  onCancel,
  submitLabel,
  busy,
}: {
  onCancel: () => void;
  submitLabel: string;
  busy?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy}>
        {submitLabel}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add / edit a lot                                                    */
/* ------------------------------------------------------------------ */

function IngredientPicker({
  value,
  onChange,
  error,
}: {
  value?: Ingredient;
  onChange: (i: Ingredient | undefined) => void;
  error?: string;
}) {
  const ingredients = useLiveQuery(
    () => db.ingredients.orderBy('name').toArray(),
    [],
    [] as Ingredient[],
  );
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<string>('Other');
  const [unit, setUnit] = useState('g');
  const [err, setErr] = useState<string>();
  const unitOptions = useUnitOptions();

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-2">
        <span className="font-semibold">{value.name}</span>
        <Button variant="ghost" onClick={() => onChange(undefined)}>
          Change
        </Button>
      </div>
    );
  }
  const term = q.trim().toLowerCase();
  const results = (
    term
      ? ingredients.filter(
          (i) =>
            i.name.toLowerCase().includes(term) ||
            i.aliases.some((a) => a.toLowerCase().includes(term)),
        )
      : ingredients
  ).slice(0, 8);
  const exact = ingredients.some((i) => i.name.toLowerCase() === term);

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
        />
        <input
          className={inputClass + ' pl-10'}
          placeholder="Search ingredients, e.g. tomato"
          aria-label="Search ingredients"
          aria-invalid={!!error}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCreating(false);
          }}
        />
      </div>
      <ul aria-label="Matching ingredients" className="grid max-h-48 gap-1 overflow-y-auto">
        {results.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onChange(i)}
              className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left hover:bg-surface-2"
            >
              <span>{i.name}</span>
              <span className="text-xs text-ink-soft">{i.category}</span>
            </button>
          </li>
        ))}
      </ul>
      {term && !exact && !creating && (
        <Button variant="soft" onClick={() => setCreating(true)}>
          Create &ldquo;{q.trim()}&rdquo;
        </Button>
      )}
      {creating && (
        // Not a <form>: this sits inside the main form, and nested forms are invalid HTML
        // (a nested submit becomes a real page navigation).
        <div
          role="group"
          aria-label="New ingredient"
          className="grid gap-3 rounded-2xl border border-line p-3"
        >
          <p className="text-sm font-semibold">New ingredient: {q.trim()}</p>
          <Field label="Category">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Usual unit">
            {(id) => (
              <select
                id={id}
                className={inputClass}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {unitOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <ErrorText id="create-err" msg={err} />
          <Button
            onClick={async () => {
              try {
                onChange(
                  await inventory.createIngredient({ name: q, category, defaultUnit: unit }),
                );
              } catch (x) {
                setErr(errorMessage(x, 'Could not create that ingredient'));
              }
            }}
          >
            Create ingredient
          </Button>
        </div>
      )}
      <ErrorText id="ing-err" msg={error} />
    </div>
  );
}

export function LotFormDialog({
  onClose,
  lot,
  ingredientId,
  defaultZone = 'pantry',
}: {
  onClose: () => void;
  lot?: InventoryLot;
  ingredientId?: string;
  defaultZone?: StorageZone;
}) {
  const { prefs } = usePrefs();
  const toast = useToast();
  const ingredients = useLiveQuery(() => db.ingredients.toArray(), [], [] as Ingredient[]);
  const [ingId, setIngId] = useState<string | undefined>(lot?.ingredientId ?? ingredientId);
  const ingredient = ingredients.find((i) => i.id === ingId);

  const [f, setF] = useState(() => ({
    quantity: lot ? String(lot.quantity) : '',
    unit: lot?.unit ?? '',
    zone: (lot?.zone ?? defaultZone) as StorageZone,
    customZoneName: lot?.customZoneName ?? '',
    dateLabel: (lot?.dateLabel ?? 'best_before') as InventoryLot['dateLabel'],
    date: lot?.date ?? '',
    purchasedOn: lot?.purchasedOn ?? '',
    openedOn: lot?.openedOn ?? '',
    packageSize: lot?.packageSize != null ? String(lot.packageSize) : '',
    lowStockThreshold: lot?.lowStockThreshold != null ? String(lot.lowStockThreshold) : '',
    cost: lot?.cost != null ? String(lot.cost) : '',
    note: lot?.note ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  // Until the user picks one, the unit follows the ingredient's usual unit.
  const unit = f.unit || ingredient?.defaultUnit || 'g';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input: LotInput = {
      ingredientId: ingId ?? '',
      quantity: f.quantity.trim() === '' ? NaN : Number(f.quantity),
      unit,
      zone: f.zone,
      customZoneName: f.zone === 'custom' ? f.customZoneName : undefined,
      dateLabel: f.dateLabel,
      date: f.dateLabel === 'unknown' ? undefined : f.date || undefined,
      purchasedOn: f.purchasedOn || undefined,
      openedOn: f.openedOn || undefined,
      packageSize: num(f.packageSize),
      lowStockThreshold: num(f.lowStockThreshold),
      cost: num(f.cost),
      currency: f.cost.trim() ? prefs.currency : undefined,
      note: f.note || undefined,
    };
    const parsed = lotInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0] ?? 'form')] ??= i.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      if (lot) await inventory.updateLot(lot.id, input);
      else await inventory.addLot(input);
      toast({
        message: lot
          ? `Updated ${ingredient?.name ?? 'item'}`
          : `Added ${formatQuantity(input.quantity, input.unit)} ${ingredient?.name ?? ''}`,
      });
      onClose();
    } catch (x) {
      setErrors({
        form: errorMessage(x, 'Could not save. Your browser storage may be full.'),
      });
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={lot ? 'Edit item' : 'Add ingredient'}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {lot ? (
          <p className="text-lg font-semibold">{ingredient?.name}</p>
        ) : (
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold">Ingredient</span>
            <IngredientPicker
              value={ingredient}
              onChange={(i) => {
                setIngId(i?.id);
                set('unit', '');
              }}
              error={errors.ingredientId}
            />
          </div>
        )}

        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field label="Quantity">
            {(id) => (
              <>
                <input
                  id={id}
                  inputMode="decimal"
                  type="number"
                  step="any"
                  min="0"
                  className={inputClass}
                  value={f.quantity}
                  aria-invalid={!!errors.quantity}
                  aria-describedby={errors.quantity ? 'q-err' : undefined}
                  onChange={(e) => set('quantity', e.target.value)}
                />
                <ErrorText id="q-err" msg={errors.quantity} />
              </>
            )}
          </Field>
          <Field label="Unit">
            {(id) => <UnitSelect id={id} value={unit} onChange={(v) => set('unit', v)} />}
          </Field>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-semibold">Stored in</span>
          <Segmented
            label="Stored in"
            value={f.zone}
            options={ZONE_OPTIONS}
            onChange={(v) => set('zone', v)}
          />
          {f.zone === 'custom' && (
            <Field label="Name this place">
              {(id) => (
                <>
                  <input
                    id={id}
                    className={inputClass}
                    maxLength={30}
                    value={f.customZoneName}
                    onChange={(e) => set('customZoneName', e.target.value)}
                  />
                  <ErrorText id="cz-err" msg={errors.customZoneName} />
                </>
              )}
            </Field>
          )}
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-semibold">Date on the package</span>
          <Segmented
            label="Date type"
            value={f.dateLabel}
            options={[
              { value: 'best_before', label: 'Best before' },
              { value: 'use_by', label: 'Use by' },
              { value: 'unknown', label: 'No date' },
            ]}
            onChange={(v) => set('dateLabel', v)}
          />
          <p className="text-sm text-ink-soft">
            {f.dateLabel === 'use_by'
              ? 'Use-by is about safety. Do not rely on it being exact: how food was stored matters too.'
              : f.dateLabel === 'best_before'
                ? 'Best-before is about quality. Food past this date is not automatically unsafe, and a date alone never guarantees safety.'
                : 'Without a date, this item will not appear in expiry alerts.'}
          </p>
          {f.dateLabel !== 'unknown' && (
            <Field label="Date">
              {(id) => (
                <>
                  <input
                    id={id}
                    type="date"
                    className={inputClass}
                    value={f.date}
                    aria-invalid={!!errors.date}
                    onChange={(e) => set('date', e.target.value)}
                  />
                  <ErrorText id="d-err" msg={errors.date} />
                </>
              )}
            </Field>
          )}
        </div>

        <details className="rounded-2xl border border-line px-4 py-3">
          <summary className="min-h-8 font-semibold">More details (optional)</summary>
          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Purchased on">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    className={inputClass}
                    value={f.purchasedOn}
                    onChange={(e) => set('purchasedOn', e.target.value)}
                  />
                )}
              </Field>
              <Field label="Opened on">
                {(id) => (
                  <>
                    <input
                      id={id}
                      type="date"
                      className={inputClass}
                      value={f.openedOn}
                      onChange={(e) => set('openedOn', e.target.value)}
                    />
                    <ErrorText id="o-err" msg={errors.openedOn} />
                  </>
                )}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Package size (${unitLabel(unit)})`}>
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    className={inputClass}
                    value={f.packageSize}
                    onChange={(e) => set('packageSize', e.target.value)}
                  />
                )}
              </Field>
              <Field
                label={`Low-stock alert at (${unitLabel(unit)})`}
                hint="Flags this ingredient when total stock falls to this."
              >
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    className={inputClass}
                    value={f.lowStockThreshold}
                    onChange={(e) => set('lowStockThreshold', e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field label={`Cost (${prefs.currency}, your estimate)`}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  className={inputClass}
                  value={f.cost}
                  onChange={(e) => set('cost', e.target.value)}
                />
              )}
            </Field>
            <Field label="Note">
              {(id) => (
                <input
                  id={id}
                  className={inputClass}
                  maxLength={200}
                  value={f.note}
                  onChange={(e) => set('note', e.target.value)}
                />
              )}
            </Field>
          </div>
        </details>

        <ErrorText id="form-err" msg={errors.form} />
        <FormActions
          onCancel={onClose}
          submitLabel={lot ? 'Save changes' : 'Add to storage'}
          busy={busy}
        />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Use some                                                            */
/* ------------------------------------------------------------------ */

export function UseDialog({
  ingredient,
  lots,
  onClose,
}: {
  ingredient: Ingredient;
  lots: InventoryLot[];
  onClose: () => void;
}) {
  const { prefs } = usePrefs();
  const toast = useToast();
  const totals = totalsFor(lots);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState(lots[0]?.unit ?? ingredient.defaultUnit);
  const [err, setErr] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = qty.trim() === '' ? NaN : Number(qty);
    if (!Number.isFinite(q) || q <= 0) return setErr('Enter a quantity greater than 0');
    try {
      const res = await inventory.consume(ingredient.id, q, unit);
      toast({
        message: `Used ${formatQuantity(q, unit)} of ${ingredient.name}`,
        action: {
          label: 'Undo',
          run: () =>
            inventory
              .undo(res.snapshots, res.steps)
              .catch((x) => toast({ message: x.message, tone: 'error' })),
        },
      });
      onClose();
    } catch (x) {
      setErr(errorMessage(x, 'Could not update stock'));
    }
  }
  return (
    <Dialog open onClose={onClose} title={`Use ${ingredient.name}`}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <p className="text-ink-soft">
          You have {formatTotals(totals, prefs.units)}. The earliest-dated stock is used first.
        </p>
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field label="Amount used">
            {(id) => (
              <input
                id={id}
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                className={inputClass}
                value={qty}
                aria-invalid={!!err}
                onChange={(e) => {
                  setQty(e.target.value);
                  setErr(undefined);
                }}
                autoFocus
              />
            )}
          </Field>
          <Field label="Unit">
            {(id) => <UnitSelect id={id} value={unit} onChange={setUnit} />}
          </Field>
        </div>
        <ErrorText id="use-err" msg={err} />
        <FormActions onCancel={onClose} submitLabel="Use" />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Move                                                                */
/* ------------------------------------------------------------------ */

export function MoveDialog({ lots, onClose }: { lots: InventoryLot[]; onClose: () => void }) {
  const toast = useToast();
  const single = lots.length === 1 ? lots[0] : undefined;
  const [zone, setZone] = useState<StorageZone>(single?.zone === 'fridge' ? 'freezer' : 'fridge');
  const [custom, setCustom] = useState('');
  const [qty, setQty] = useState(single ? String(single.quantity) : '');
  const [err, setErr] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (single) {
        const q = Number(qty);
        await inventory.transfer(single.id, zone, custom, q === single.quantity ? undefined : q);
      } else {
        await inventory.transferBulk(
          lots.map((l) => l.id),
          zone,
          custom,
        );
      }
      toast({ message: `Moved to ${zone === 'custom' ? custom : ZONE_LABEL[zone]}` });
      onClose();
    } catch (x) {
      setErr(errorMessage(x, 'Could not move'));
    }
  }
  return (
    <Dialog open onClose={onClose} title="Move to…">
      <form onSubmit={submit} noValidate className="grid gap-4">
        <Segmented label="Move to" value={zone} options={ZONE_OPTIONS} onChange={setZone} />
        {zone === 'custom' && (
          <Field label="Name this place">
            {(id) => (
              <input
                id={id}
                className={inputClass}
                maxLength={30}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            )}
          </Field>
        )}
        {single && (
          <Field
            label={`How much? (up to ${formatQuantity(single.quantity, single.unit)})`}
            hint="Moving part of it splits it into two lots with the same date."
          >
            {(id) => (
              <input
                id={id}
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                className={inputClass}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            )}
          </Field>
        )}
        <ErrorText id="mv-err" msg={err} />
        <FormActions onCancel={onClose} submitLabel="Move" />
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm                                                             */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onClose={onClose} title={title}>
      <div className="grid gap-4">
        <div className="text-ink-soft">{children}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                onClose();
              }
            }}
          >
            <Check aria-hidden className="size-4" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
