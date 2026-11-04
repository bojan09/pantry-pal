import { useMemo, useState } from 'react';
import { errorMessage } from '@/data/errors';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { shopping } from '@/data/shopping';
import { Button, Dialog, inputClass } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { buildNeeds, explainNeed, type DemandInput } from '@/domain/shopping';
import { formatAmount } from '@/domain/scaling';

export interface Demand {
  recipeId: string;
  servings: number;
}

const NEW = '__new__';

/**
 * Shows exactly what would be added to a list and why, before anything is written:
 * needed − in pantry − already on the list.
 */
export function GenerateDialog({
  title,
  demands,
  initialListId,
  onClose,
}: {
  title: string;
  demands: Demand[];
  initialListId?: string;
  onClose: () => void;
}) {
  const { prefs } = usePrefs();
  const toast = useToast();
  const [listId, setListId] = useState(initialListId ?? '');
  const [newName, setNewName] = useState('Groceries');
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const data = useLiveQuery(async () => {
    const [recipes, lines, ingredients, lots, lists, items] = await Promise.all([
      db.recipes.toArray(),
      db.recipeIngredients.toArray(),
      db.ingredients.toArray(),
      db.inventoryLots.toArray(),
      db.shoppingLists.orderBy('id').toArray(),
      db.shoppingItems.toArray(),
    ]);
    return { recipes, lines, ingredients, lots, lists, items };
  }, []);

  const effectiveList = data
    ? listId === NEW
      ? NEW
      : (data.lists.find((l) => l.id === listId)?.id ?? data.lists[0]?.id ?? NEW)
    : '';

  const rows = useMemo(() => {
    if (!data) return [];
    const ingredients = new Map(data.ingredients.map((i) => [i.id, i]));
    const inputs: DemandInput[] = [];
    for (const d of demands) {
      const r = data.recipes.find((x) => x.id === d.recipeId);
      if (!r) continue;
      inputs.push({
        recipeName: r.name,
        lines: data.lines.filter((l) => l.recipeId === r.id),
        factor: d.servings / r.servings,
      });
    }
    const listItems = data.items.filter((i) => i.listId === effectiveList);
    return buildNeeds(inputs, ingredients, data.lots, listItems);
  }, [data, demands, effectiveList]);

  const toAdd = rows.filter((r) => r.toBuy > 0);
  const chosen = toAdd.filter((r) => !skip.has(r.key));
  const covered = rows.filter((r) => r.toBuy === 0);

  async function confirm() {
    setBusy(true);
    setError(undefined);
    try {
      let id = effectiveList;
      if (id === NEW) id = (await shopping.createList(newName, prefs.currency)).id;
      const res = await shopping.applyNeeds(id, chosen);
      toast({
        message: `Added ${res.added} item${res.added === 1 ? '' : 's'}${res.merged ? `, updated ${res.merged}` : ''} on your list`,
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Could not update the list'));
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={title}>
      <div className="grid gap-4">
        {!data ? (
          <p className="text-ink-soft">Working it out…</p>
        ) : (
          <>
            <div className="grid gap-1.5">
              <label htmlFor="gen-list" className="text-sm font-semibold">
                Add to list
              </label>
              <select
                id="gen-list"
                className={inputClass}
                value={effectiveList}
                onChange={(e) => setListId(e.target.value)}
              >
                {data.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
                <option value={NEW}>New list…</option>
              </select>
              {effectiveList === NEW && (
                <input
                  aria-label="New list name"
                  className={inputClass}
                  value={newName}
                  maxLength={50}
                  onChange={(e) => setNewName(e.target.value)}
                />
              )}
            </div>
            <p className="text-sm text-ink-soft">
              Each line is what the recipes need, minus what is in your pantry, minus what is
              already on the list. Optional ingredients are not added.
            </p>
            {toAdd.length === 0 ? (
              <p className="rounded-2xl bg-good-soft px-4 py-3 font-medium text-good">
                Nothing to buy. Your pantry and list already cover everything.
              </p>
            ) : (
              <ul
                className="grid max-h-[40vh] gap-2 overflow-y-auto pr-1"
                aria-label="Items to add"
              >
                {toAdd.map((r) => (
                  <li key={r.key} className="rounded-2xl bg-surface-2 p-3">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-5 accent-[var(--color-accent)]"
                        checked={!skip.has(r.key)}
                        onChange={(e) =>
                          setSkip((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.delete(r.key);
                            else n.add(r.key);
                            return n;
                          })
                        }
                      />
                      <span className="flex-1 font-semibold">{r.name}</span>
                      <span className="font-semibold tabular-nums">
                        {formatAmount(r.toBuy, r.unit, prefs.units)}
                      </span>
                    </label>
                    <p className="pl-8 text-sm text-ink-soft">
                      {explainNeed({ ...r, unit: r.unit })}
                      {r.sources.length > 0 && ` · for ${r.sources.join(', ')}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {covered.length > 0 && (
              <details className="text-sm">
                <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                  Already covered ({covered.length})
                </summary>
                <ul className="grid gap-1 text-ink-soft">
                  {covered.map((r) => (
                    <li key={r.key}>
                      <span className="font-medium text-ink">{r.name}</span>: {explainNeed(r)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
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
          <Button disabled={busy || !data || chosen.length === 0} onClick={() => void confirm()}>
            Add {chosen.length} {chosen.length === 1 ? 'item' : 'items'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
