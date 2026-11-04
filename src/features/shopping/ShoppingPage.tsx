import { useMemo, useState } from 'react';
import { errorMessage } from '@/data/errors';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Copy,
  PackagePlus,
  Pencil,
  Plus,
  Settings2,
  Share2,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { db } from '@/data/db';
import { shopping } from '@/data/shopping';
import type { Ingredient, ShoppingItem, ShoppingList } from '@/data/types';
import { Button, Card, cx, Dialog, EmptyState, inputClass, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { CURRENCIES } from '@/app/prefs';
import { estimateTotal, groupByCategory, lineCost, priceBasis, shareText } from '@/domain/shopping';
import { formatAmount } from '@/domain/scaling';
import { UNITS, unitsForSystem } from '@/domain/units';
import { ConfirmDialog } from '../pantry/dialogs';
import { StockDialog } from './StockDialog';

const errMsg = (e: unknown) => errorMessage(e, 'Something went wrong');
const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
};

function NameDialog({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  onSave: (n: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [err, setErr] = useState<string>();
  return (
    <Dialog open onClose={onClose} title={title}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave(name);
            onClose();
          } catch (er) {
            setErr(errMsg(er));
          }
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="list-name" className="text-sm font-semibold">
            List name
          </label>
          <input
            id="list-name"
            className={inputClass}
            value={name}
            maxLength={50}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setErr(undefined);
            }}
          />
          {err && (
            <p role="alert" className="text-sm font-medium text-bad">
              {err}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ListSettings({ list, onClose }: { list: ShoppingList; onClose: () => void }) {
  const toast = useToast();
  const [budget, setBudget] = useState(list.budget != null ? String(list.budget) : '');
  const [currency, setCurrency] = useState(list.currency);
  const [err, setErr] = useState<string>();
  return (
    <Dialog open onClose={onClose} title="List settings">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const b = budget.trim() === '' ? null : Number(budget.replace(',', '.'));
            if (b !== null && !Number.isFinite(b)) throw new Error('Enter a number for the budget');
            await shopping.updateList(list.id, { budget: b, currency });
            toast({ message: 'List settings saved' });
            onClose();
          } catch (er) {
            setErr(errMsg(er));
          }
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="ls-cur" className="text-sm font-semibold">
            Currency
          </label>
          <select
            id="ls-cur"
            className={inputClass}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <p className="text-sm text-ink-soft">
            Prices on this list are in this currency. Changing it does not convert prices already
            entered.
          </p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="ls-budget" className="text-sm font-semibold">
            Budget (optional)
          </label>
          <input
            id="ls-budget"
            inputMode="decimal"
            className={inputClass}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        {err && (
          <p role="alert" className="text-sm font-medium text-bad">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ItemDialog({
  item,
  list,
  ingredients,
  onClose,
}: {
  item: ShoppingItem;
  list: ShoppingList;
  ingredients: Ingredient[];
  onClose: () => void;
}) {
  const { prefs } = usePrefs();
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.quantity != null ? String(item.quantity) : '');
  const [unit, setUnit] = useState(item.unit ?? '');
  const [price, setPrice] = useState(item.unitPrice != null ? String(item.unitPrice) : '');
  const [note, setNote] = useState(item.note ?? '');
  const [err, setErr] = useState<string>();
  const units = unitsForSystem(prefs.units);
  const basis = priceBasis(unit || undefined);
  const ing = ingredients.find((i) => i.id === item.ingredientId);
  return (
    <Dialog open onClose={onClose} title="Edit item">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const q = qty.trim() === '' ? undefined : Number(qty.replace(',', '.'));
            const p = price.trim() === '' ? undefined : Number(price.replace(',', '.'));
            if (
              (q !== undefined && !Number.isFinite(q)) ||
              (p !== undefined && !Number.isFinite(p))
            )
              throw new Error('Amounts and prices must be numbers');
            await shopping.updateItem(item.id, {
              name,
              quantity: q,
              unit: q === undefined ? undefined : unit || undefined,
              category: item.category,
              ingredientId: item.ingredientId,
              unitPrice: p,
              note,
            });
            onClose();
          } catch (er) {
            setErr(errMsg(er));
          }
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="it-name" className="text-sm font-semibold">
            Item
          </label>
          <input
            id="it-name"
            className={inputClass}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          {ing && <p className="text-sm text-ink-soft">Linked to {ing.name} in your pantry.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="it-qty" className="text-sm font-semibold">
              Amount
            </label>
            <input
              id="it-qty"
              inputMode="decimal"
              className={inputClass}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="it-unit" className="text-sm font-semibold">
              Unit
            </label>
            <select
              id="it-unit"
              className={inputClass}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="">None</option>
              {(unit && !units.some((u) => u.id === unit)
                ? [...units, ...UNITS.filter((u) => u.id === unit)]
                : units
              ).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="it-price" className="text-sm font-semibold">
            Price per {basis.label} ({list.currency}, optional)
          </label>
          <input
            id="it-price"
            inputMode="decimal"
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <p className="text-sm text-ink-soft">Your own estimate, not a live store price.</p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="it-note" className="text-sm font-semibold">
            Note (optional)
          </label>
          <input
            id="it-note"
            className={inputClass}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {err && (
          <p role="alert" className="text-sm font-medium text-bad">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ShoppingPage() {
  const { prefs } = usePrefs();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [dlg, setDlg] = useState<
    | { k: 'newList' }
    | { k: 'rename' }
    | { k: 'settings' }
    | { k: 'deleteList' }
    | { k: 'edit'; item: ShoppingItem }
    | { k: 'stock' }
    | null
  >(null);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [addErr, setAddErr] = useState<string>();

  const data = useLiveQuery(async () => {
    const [lists, items, ingredients] = await Promise.all([
      db.shoppingLists.toArray(),
      db.shoppingItems.toArray(),
      db.ingredients.orderBy('name').toArray(),
    ]);
    return { lists: lists.sort((a, b) => a.createdAt - b.createdAt), items, ingredients };
  }, []);

  const list: ShoppingList | undefined = data
    ? (data.lists.find((l) => l.id === params.get('list')) ?? data.lists[0])
    : undefined;
  const items = useMemo(
    () => (data && list ? data.items.filter((i) => i.listId === list.id) : []),
    [data, list],
  );
  const open = items.filter((i) => !i.stockedAt);
  const stocked = items.filter((i) => i.stockedAt);
  const ticked = open.filter((i) => i.checked);
  const totals = estimateTotal(open);
  const units = unitsForSystem(prefs.units);

  const text = () =>
    shareText(list!.name, open, (i) =>
      i.quantity && i.unit ? `${formatAmount(i.quantity, i.unit, prefs.units)} ${i.name}` : i.name,
    );

  async function share(copyOnly: boolean) {
    const t = text();
    try {
      if (!copyOnly && typeof navigator.share === 'function') {
        await navigator.share({ title: list!.name, text: t });
        return;
      }
      await navigator.clipboard.writeText(t);
      toast({ message: 'List copied. Paste it into any message.' });
    } catch (e) {
      if ((e as Error).name !== 'AbortError')
        toast({ message: 'Could not share or copy the list', tone: 'error' });
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(undefined);
    try {
      const t = name.trim();
      const match = data!.ingredients.find(
        (i) =>
          i.name.toLowerCase() === t.toLowerCase() ||
          i.aliases.some((a) => a.toLowerCase() === t.toLowerCase()),
      );
      const q = qty.trim() === '' ? undefined : Number(qty.replace(',', '.'));
      if (q !== undefined && !Number.isFinite(q)) throw new Error('Amount must be a number');
      await shopping.addItem(list!.id, {
        name: match?.name ?? t,
        ingredientId: match?.id,
        category: match?.category ?? 'Other',
        quantity: q,
        unit: q === undefined ? undefined : unit || match?.defaultUnit || 'pcs',
      });
      setName('');
      setQty('');
    } catch (er) {
      setAddErr(errMsg(er));
    }
  }

  if (!data) return <PageHeader title="Shopping List" back="/more" />;

  return (
    <>
      <PageHeader
        title="Shopping List"
        subtitle="What to buy, grouped by aisle."
        back="/more"
        actions={
          <Button onClick={() => setDlg({ k: 'newList' })}>
            <Plus aria-hidden className="size-4" /> New list
          </Button>
        }
      />
      {!list ? (
        <Card>
          <EmptyState
            art={<ShoppingCart aria-hidden className="size-full text-accent-bright" />}
            title="No shopping lists yet"
            body="Create a list, add items by hand, or generate one from your meal plan or a recipe. It subtracts what you already have."
            action={<Button onClick={() => setDlg({ k: 'newList' })}>Create a list</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          <Card className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Lists">
              {data.lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={l.id === list.id}
                  onClick={() => setParams({ list: l.id }, { replace: true })}
                  className={cx(
                    'pp-lift min-h-11 rounded-full border px-4 text-sm font-semibold',
                    l.id === list.id
                      ? 'border-transparent bg-accent text-accent-ink'
                      : 'border-line bg-surface',
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setDlg({ k: 'rename' })}>
                <Pencil aria-hidden className="size-4" /> Rename
              </Button>
              <Button variant="ghost" onClick={() => setDlg({ k: 'settings' })}>
                <Settings2 aria-hidden className="size-4" /> Budget and currency
              </Button>
              <Button
                variant="ghost"
                disabled={open.length === 0}
                onClick={() => void share(false)}
              >
                <Share2 aria-hidden className="size-4" /> Share
              </Button>
              <Button variant="ghost" disabled={open.length === 0} onClick={() => void share(true)}>
                <Copy aria-hidden className="size-4" /> Copy as text
              </Button>
              <Button variant="ghost" onClick={() => setDlg({ k: 'deleteList' })}>
                <Trash2 aria-hidden className="size-4" /> Delete list
              </Button>
            </div>
          </Card>

          <Card as="div">
            <form
              onSubmit={add}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto]"
              aria-label="Add an item"
            >
              <datalist id="shop-ings">
                {data.ingredients.map((i) => (
                  <option key={i.id} value={i.name} />
                ))}
              </datalist>
              <input
                aria-label="Item name"
                list="shop-ings"
                placeholder="Add an item, e.g. Flour"
                className={inputClass}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                aria-label="Amount (optional)"
                inputMode="decimal"
                placeholder="Amount"
                className={inputClass}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <select
                aria-label="Unit"
                className={inputClass}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="">Default unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
              <Button type="submit">
                <Plus aria-hidden className="size-4" /> Add
              </Button>
            </form>
            {addErr && (
              <p role="alert" className="mt-2 text-sm font-medium text-bad">
                {addErr}
              </p>
            )}
          </Card>

          {open.length === 0 && stocked.length === 0 ? (
            <Card>
              <EmptyState
                art={<ShoppingCart aria-hidden className="size-full text-accent-bright" />}
                title="This list is empty"
                body="Add an item above, or open the Meal Planner or a recipe and choose the shopping list button."
              />
            </Card>
          ) : (
            <>
              <Card className="grid gap-1">
                <p className="font-semibold" aria-live="polite">
                  {ticked.length} of {open.length} ticked
                </p>
                <p className="text-sm text-ink-soft">
                  {totals.priced > 0 ? (
                    <>
                      Estimated total from the prices you entered:{' '}
                      <strong className="text-ink">{money(totals.total, list.currency)}</strong>
                      {totals.unpriced > 0 &&
                        ` (${totals.unpriced} item${totals.unpriced === 1 ? ' has' : 's have'} no price)`}
                      {list.budget != null && (
                        <span
                          className={cx(
                            'ml-1 font-semibold',
                            totals.total > list.budget ? 'text-bad' : 'text-good',
                          )}
                        >
                          ·{' '}
                          {totals.total > list.budget
                            ? `${money(totals.total - list.budget, list.currency)} over`
                            : `${money(list.budget - totals.total, list.currency)} under`}{' '}
                          budget of {money(list.budget, list.currency)}
                        </span>
                      )}
                    </>
                  ) : (
                    'Add prices to items to see an estimate. Totals are never mixed across currencies.'
                  )}
                </p>
                <p className="text-sm text-ink-soft">
                  Ticking an item does not change your pantry.
                </p>
              </Card>

              {groupByCategory(open).map(([cat, group]) => (
                <Card key={cat} aria-labelledby={`cat-${cat}`}>
                  <h2 id={`cat-${cat}`} className="text-xl font-semibold">
                    {cat}
                  </h2>
                  <ul className="mt-2 divide-y divide-line">
                    {group.map((i) => {
                      const cost = lineCost(i);
                      return (
                        <li key={i.id} className="flex items-center gap-2">
                          <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 py-1">
                            <input
                              type="checkbox"
                              className="size-5 accent-[var(--color-accent)]"
                              checked={i.checked}
                              onChange={(e) => void shopping.setChecked(i.id, e.target.checked)}
                            />
                            <span
                              className={cx('flex-1', i.checked && 'text-ink-soft line-through')}
                            >
                              {i.quantity && i.unit && (
                                <span className="mr-2 font-semibold tabular-nums">
                                  {formatAmount(i.quantity, i.unit, prefs.units)}
                                </span>
                              )}
                              {i.name}
                              {i.note && (
                                <span className="block text-sm text-ink-soft">{i.note}</span>
                              )}
                            </span>
                            {cost != null && (
                              <span className="text-sm tabular-nums text-ink-soft">
                                {money(cost, list.currency)}
                              </span>
                            )}
                          </label>
                          <button
                            type="button"
                            aria-label={`Edit ${i.name}`}
                            onClick={() => setDlg({ k: 'edit', item: i })}
                            className="pp-lift grid size-11 place-items-center rounded-full"
                          >
                            <Pencil aria-hidden className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${i.name}`}
                            onClick={() => void shopping.removeItems([i.id])}
                            className="pp-lift grid size-11 place-items-center rounded-full"
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}

              <div className="flex flex-wrap gap-2">
                <Button disabled={ticked.length === 0} onClick={() => setDlg({ k: 'stock' })}>
                  <PackagePlus aria-hidden className="size-4" /> Add {ticked.length || ''} ticked to
                  pantry…
                </Button>
                <Button
                  variant="ghost"
                  disabled={ticked.length === 0}
                  onClick={() => void shopping.removeItems(ticked.map((i) => i.id))}
                >
                  Remove ticked items
                </Button>
              </div>

              {stocked.length > 0 && (
                <Card aria-labelledby="stocked-h">
                  <h2 id="stocked-h" className="text-xl font-semibold">
                    Added to your pantry
                  </h2>
                  <ul className="mt-2 grid gap-1 text-ink-soft">
                    {stocked.map((i) => (
                      <li key={i.id}>
                        {i.quantity && i.unit
                          ? `${formatAmount(i.quantity, i.unit, prefs.units)} `
                          : ''}
                        {i.name}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="ghost"
                    className="mt-2"
                    onClick={() => void shopping.removeItems(stocked.map((i) => i.id))}
                  >
                    Clear these
                  </Button>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {dlg?.k === 'newList' && (
        <NameDialog
          title="New shopping list"
          initial=""
          onClose={() => setDlg(null)}
          onSave={async (n) => {
            const l = await shopping.createList(n, prefs.currency);
            setParams({ list: l.id }, { replace: true });
          }}
        />
      )}
      {dlg?.k === 'rename' && list && (
        <NameDialog
          title="Rename list"
          initial={list.name}
          onClose={() => setDlg(null)}
          onSave={(n) => shopping.updateList(list.id, { name: n })}
        />
      )}
      {dlg?.k === 'settings' && list && <ListSettings list={list} onClose={() => setDlg(null)} />}
      {dlg?.k === 'edit' && list && (
        <ItemDialog
          item={dlg.item}
          list={list}
          ingredients={data.ingredients}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg?.k === 'stock' && <StockDialog items={ticked} onClose={() => setDlg(null)} />}
      {dlg?.k === 'deleteList' && list && (
        <ConfirmDialog
          title="Delete this list?"
          confirmLabel="Delete list"
          danger
          onClose={() => setDlg(null)}
          onConfirm={async () => {
            await shopping.deleteList(list.id);
            setParams({}, { replace: true });
            toast({ message: `Deleted ${list.name}` });
          }}
        >
          <p>
            &ldquo;{list.name}&rdquo; and its {items.length} items will be removed. Your pantry is
            not affected.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
