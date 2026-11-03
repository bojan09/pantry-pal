import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search } from 'lucide-react';
import { db } from '@/data/db';
import { inventory } from '@/data/inventory';
import { loadSamplePantry, removeSamplePantry } from '@/data/samplePantry';
import { CATEGORIES, spriteKindFor } from '@/data/catalog';
import type { StorageZone } from '@/data/types';
import { daysUntil, statusText, type IngredientSummary } from '@/domain/lots';
import { colorFor, ItemSprite } from '@/design/illustrations/sprites';
import { Basket } from '@/design/illustrations';
import { Button, Card, Chip, cx, EmptyState, inputClass, PageHeader, Segmented } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { ConfirmDialog, LotFormDialog, MoveDialog } from './dialogs';
import { formatTotals, STATUS_CLASS, STATUS_WORD, ZONE_LABEL } from './format';
import { usePantryData } from './hooks';
import { LivingPantry } from './LivingPantry';

type SceneZone = 'pantry' | 'fridge' | 'freezer';
type ListZone = 'all' | StorageZone;
type Sort = 'name' | 'soonest' | 'recent';

const SCENE_ZONES: { value: SceneZone; label: string }[] = [
  { value: 'pantry', label: 'Pantry' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
];

export function SummaryTiles({ all }: { all: IngredientSummary[] }) {
  const attention = all.filter((s) => s.status === 'soon' || s.status === 'expired').length;
  const low = all.filter((s) => s.low).length;
  const tiles: [number, string][] = [
    [all.length, 'Ingredients'],
    [attention, 'Dates to check'],
    [low, 'Low stock'],
  ];
  return (
    <dl className="grid grid-cols-3 gap-3 text-center">
      {tiles.map(([n, l]) => (
        <div key={l} className="pp-card px-2 py-3">
          <dd className="font-display text-3xl font-semibold text-accent-text">{n}</dd>
          <dt className="text-xs text-ink-soft">{l}</dt>
        </div>
      ))}
    </dl>
  );
}

export function PantryPage() {
  const data = usePantryData();
  const { prefs } = usePrefs();
  const navigate = useNavigate();
  const toast = useToast();
  const [view, setView] = useState<'scene' | 'list'>('scene');
  const [zone, setZone] = useState<ListZone>('pantry');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [only, setOnly] = useState<'' | 'low' | 'attention' | 'nodate'>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null | 'add' | 'move' | 'discard'>(null);
  const sampleCount = useLiveQuery(
    () => db.inventoryLots.filter((l) => l.sample === true).count(),
    [],
    0,
  );

  const sceneZone: SceneZone = zone === 'fridge' || zone === 'freezer' ? zone : 'pantry';

  const rows = useMemo(() => {
    if (!data) return [];
    let list = zone === 'all' ? data.all : data.byZone(zone);
    const term = q.trim().toLowerCase();
    if (term)
      list = list.filter(
        (s) =>
          s.ingredient.name.toLowerCase().includes(term) ||
          s.ingredient.aliases.some((a) => a.toLowerCase().includes(term)),
      );
    if (category) list = list.filter((s) => s.ingredient.category === category);
    if (only === 'low') list = list.filter((s) => s.low);
    if (only === 'attention')
      list = list.filter((s) => s.status === 'soon' || s.status === 'expired');
    if (only === 'nodate') list = list.filter((s) => s.status === 'none');
    const key = (s: IngredientSummary) => s.nextLot?.date ?? '9999-12-31';
    return [...list].sort((a, b) =>
      sort === 'soonest'
        ? key(a).localeCompare(key(b)) || a.ingredient.name.localeCompare(b.ingredient.name)
        : sort === 'recent'
          ? Math.max(...b.lots.map((l) => l.createdAt)) -
            Math.max(...a.lots.map((l) => l.createdAt))
          : a.ingredient.name.localeCompare(b.ingredient.name),
    );
  }, [data, zone, q, category, sort, only]);

  if (!data) return <PageHeader title="My Pantry" subtitle="Loading…" />;

  const empty = data.lots.length === 0;
  const selectedLots = rows.filter((r) => selected.has(r.ingredient.id)).flatMap((r) => r.lots);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.ingredient.id));

  return (
    <>
      <PageHeader
        title="My Pantry"
        subtitle="Everything you have, by shelf."
        actions={
          <Button onClick={() => setDialog('add')}>
            <Plus aria-hidden className="size-4" /> Add ingredient
          </Button>
        }
      />

      {empty ? (
        <Card>
          <EmptyState
            art={<Basket />}
            title="Your pantry is empty"
            body="Nothing is logged yet. Add what you have, or load a clearly-labelled sample pantry to explore."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setDialog('add')}>
                  <Plus aria-hidden className="size-4" /> Add ingredient
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    const n = await loadSamplePantry();
                    toast({ message: `Loaded ${n} sample items` });
                  }}
                >
                  Load sample pantry
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          <SummaryTiles all={data.all} />
          <Card className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                label="View"
                value={view}
                options={[
                  { value: 'scene', label: 'Shelves' },
                  { value: 'list', label: 'List' },
                ]}
                onChange={setView}
              />
              {view === 'scene' ? (
                <Segmented
                  label="Storage zone"
                  value={sceneZone}
                  options={SCENE_ZONES}
                  onChange={setZone}
                />
              ) : (
                <Segmented
                  label="Storage zone"
                  value={zone}
                  options={[
                    { value: 'all', label: 'All' },
                    ...SCENE_ZONES,
                    { value: 'custom', label: 'Other' },
                  ]}
                  onChange={(z) => {
                    setZone(z);
                    setSelected(new Set());
                  }}
                />
              )}
            </div>

            {view === 'scene' ? (
              <LivingPantry
                zone={sceneZone}
                items={data.byZone(sceneZone)}
                system={prefs.units}
                today={data.today}
                leadDays={data.leadDays}
                onSelect={(id) => navigate(`/pantry/${id}`)}
                onOverflow={() => {
                  setView('list');
                }}
              />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <div className="relative">
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
                    />
                    <input
                      className={inputClass + ' pl-10'}
                      placeholder="Search your ingredients"
                      aria-label="Search your ingredients"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Category"
                    className={inputClass}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Sort by"
                    className={inputClass}
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                  >
                    <option value="name">Name</option>
                    <option value="soonest">Soonest date</option>
                    <option value="recent">Recently added</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
                  {(
                    [
                      ['low', 'Low stock'],
                      ['attention', 'Dates to check'],
                      ['nodate', 'No date'],
                    ] as const
                  ).map(([v, l]) => (
                    <Chip
                      key={v}
                      selected={only === v}
                      onClick={() => setOnly(only === v ? '' : v)}
                    >
                      {l}
                    </Chip>
                  ))}
                </div>

                {selected.size > 0 && (
                  <div
                    role="region"
                    aria-label="Bulk actions"
                    className="flex flex-wrap items-center gap-2 rounded-2xl bg-accent-soft p-3"
                  >
                    <span className="flex-1 text-sm font-semibold">{selected.size} selected</span>
                    <Button variant="ghost" onClick={() => setDialog('move')}>
                      Move…
                    </Button>
                    <Button variant="danger" onClick={() => setDialog('discard')}>
                      Discard
                    </Button>
                    <Button variant="ghost" onClick={() => setSelected(new Set())}>
                      Clear
                    </Button>
                  </div>
                )}

                {rows.length === 0 ? (
                  <p className="py-6 text-center text-ink-soft">
                    Nothing matches. Try clearing a filter.
                  </p>
                ) : (
                  <>
                    <label className="flex min-h-11 w-fit items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="size-5 accent-[var(--accent)]"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(
                            allSelected ? new Set() : new Set(rows.map((r) => r.ingredient.id)),
                          )
                        }
                      />
                      Select all
                    </label>
                    <ul className="divide-y divide-line">
                      {rows.map((s) => (
                        <li key={s.ingredient.id} className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            aria-label={`Select ${s.ingredient.name}`}
                            className="size-5 shrink-0 accent-[var(--accent)]"
                            checked={selected.has(s.ingredient.id)}
                            onChange={() => toggle(s.ingredient.id)}
                          />
                          <Link
                            to={`/pantry/${s.ingredient.id}`}
                            className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl px-2 hover:bg-surface-2"
                          >
                            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2">
                              <ItemSprite
                                name={s.ingredient.name}
                                kind={spriteKindFor(s.ingredient)}
                                color={colorFor(s.ingredient.name, s.ingredient.id)}
                                className="h-9"
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">
                                {s.ingredient.name}
                              </span>
                              <span className="block text-sm text-ink-soft">
                                {formatTotals(s.totals, prefs.units)} · {s.lots.length}{' '}
                                {s.lots.length === 1 ? 'lot' : 'lots'}
                                {zone === 'all' &&
                                  ` · ${s.zones.map((z) => ZONE_LABEL[z]).join(', ')}`}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              {s.status !== 'none' && (
                                <span
                                  className={cx(
                                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                    STATUS_CLASS[s.status],
                                  )}
                                  title={
                                    s.nextLot
                                      ? statusText(s.nextLot, data.today, data.leadDays)
                                      : undefined
                                  }
                                >
                                  {s.status === 'ok'
                                    ? `${daysUntil(s.nextLot!.date!, data.today)} d`
                                    : STATUS_WORD[s.status]}
                                </span>
                              )}
                              {s.low && (
                                <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn">
                                  Low stock
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {sampleCount > 0 && (
        <p className="mt-4 w-fit rounded-2xl text-sm text-ink-soft lg:bg-surface lg:px-4 lg:py-2 lg:shadow-card">
          {sampleCount} sample items are mixed in.{' '}
          <button
            type="button"
            className="font-semibold text-accent-text underline underline-offset-4"
            onClick={async () => {
              const n = await removeSamplePantry();
              toast({ message: `Removed ${n} sample items` });
            }}
          >
            Remove sample items
          </button>
        </p>
      )}

      {dialog === 'add' && (
        <LotFormDialog
          onClose={() => setDialog(null)}
          defaultZone={view === 'scene' || zone === 'all' ? sceneZone : zone}
        />
      )}
      {dialog === 'move' && (
        <MoveDialog
          lots={selectedLots}
          onClose={() => {
            setDialog(null);
            setSelected(new Set());
          }}
        />
      )}
      {dialog === 'discard' && (
        <ConfirmDialog
          title={`Discard ${selected.size} ${selected.size === 1 ? 'ingredient' : 'ingredients'}?`}
          confirmLabel="Discard"
          danger
          onClose={() => {
            setDialog(null);
            setSelected(new Set());
          }}
          onConfirm={async () => {
            const removed = await inventory.deleteLotsBulk(selectedLots.map((l) => l.id));
            toast({
              message: `Discarded ${removed.length} ${removed.length === 1 ? 'lot' : 'lots'}`,
              action: {
                label: 'Undo',
                run: () =>
                  inventory
                    .undo(removed)
                    .catch((x) => toast({ message: x.message, tone: 'error' })),
              },
            });
          }}
        >
          This removes all lots of the selected ingredients shown here. You can undo right after.
        </ConfirmDialog>
      )}
    </>
  );
}
