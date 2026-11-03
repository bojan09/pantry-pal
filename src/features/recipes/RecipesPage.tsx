import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, FileUp, History, Layers, Plus, Search } from 'lucide-react';
import { Button, Card, Chip, EmptyState, inputClass, LinkButton, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import {
  emptyFilters,
  matchesRecipe,
  sortRecipes,
  type RecipeFilters,
  type RecipeSort,
} from '@/domain/recipes';
import { RecipeCard } from './RecipeCard';
import { ImportDialog } from './ImportDialog';
import { useRecipeLibrary } from './hooks';

const TIMES = [15, 30, 45, 60];
const unique = (xs: (string | undefined)[]) =>
  [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));

const selectClass = inputClass + ' w-auto min-w-36';

export function RecipesPage() {
  const lib = useRecipeLibrary();
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState<RecipeFilters>(emptyFilters);
  const { prefs } = usePrefs();
  const [sortChoice, setSort] = useState<RecipeSort | null>(null);
  const [avoid, setAvoid] = useState(true);
  const [dietOnly, setDietOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const q = params.get('q') ?? '';
  const collectionId = params.get('collection') ?? '';
  const readyOnly = params.get('ready') === '1';
  const setReadyOnly = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set('ready', '1');
    else next.delete('ready');
    setParams(next, { replace: true });
  };

  const hasStock = !!lib && [...lib.availability.values()].some((a) => a.have > 0);
  const sort: RecipeSort = sortChoice ?? (hasStock ? 'match' : 'name');
  const shown = useMemo(() => {
    if (!lib) return [];
    const col = lib.collections.find((c) => c.id === collectionId);
    const filters: RecipeFilters = {
      ...f,
      q,
      collectionRecipeIds: col ? new Set(col.recipeIds) : null,
    };
    const list = lib.recipes.filter((r) => {
      const m = lib.matches.get(r.id);
      return (
        matchesRecipe(r, lib.terms.get(r.id) ?? [], filters) &&
        (!readyOnly || lib.availability.get(r.id)?.ready) &&
        (!avoid || !prefs.allergens.length || !m?.allergens.length) &&
        (!dietOnly || !prefs.diets.length || !!m?.diets.length)
      );
    });
    const scores = new Map([...lib.matches].map(([id, m]) => [id, m.score]));
    return sortRecipes(list, sort, lib.lastCooked, scores);
  }, [lib, f, q, sort, readyOnly, collectionId, avoid, dietOnly, prefs.allergens, prefs.diets]);

  const set = (patch: Partial<RecipeFilters>) => setF((cur) => ({ ...cur, ...patch }));
  const setQ = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set('q', v);
    else next.delete('q');
    setParams(next, { replace: true });
  };
  const filtered =
    q ||
    collectionId ||
    readyOnly ||
    f.favoritesOnly ||
    f.category ||
    f.cuisine ||
    f.difficulty ||
    f.maxMinutes != null;
  const clear = () => {
    setF(emptyFilters);
    setReadyOnly(false);
    setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Recipes"
        subtitle="Your cookbook, searchable offline."
        actions={
          <>
            <Button variant="ghost" onClick={() => setImporting(true)}>
              <FileUp aria-hidden className="size-4" /> Import
            </Button>
            <LinkButton to="/recipes/new">
              <Plus aria-hidden className="size-4" /> New recipe
            </LinkButton>
          </>
        }
      />
      <div className="grid gap-4">
        <Card className="grid gap-4">
          <div role="search" className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft"
            />
            <input
              type="search"
              aria-label="Search recipes"
              placeholder="Search by name, ingredient, tag or cuisine"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={inputClass + ' rounded-full pl-12'}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
            <Chip
              selected={f.favoritesOnly}
              onClick={() => set({ favoritesOnly: !f.favoritesOnly })}
            >
              Favourites
            </Chip>
            <Chip selected={readyOnly} onClick={() => setReadyOnly(!readyOnly)}>
              I can make it now
            </Chip>
            {prefs.allergens.length > 0 && (
              <Chip selected={avoid} onClick={() => setAvoid(!avoid)}>
                Hide recipes with my allergens
              </Chip>
            )}
            {prefs.diets.length > 0 && (
              <Chip selected={dietOnly} onClick={() => setDietOnly(!dietOnly)}>
                Matches my diet tags
              </Chip>
            )}
            <select
              aria-label="Category"
              className={selectClass}
              value={f.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              <option value="">Any category</option>
              {unique(lib?.recipes.map((r) => r.category) ?? []).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Cuisine"
              className={selectClass}
              value={f.cuisine}
              onChange={(e) => set({ cuisine: e.target.value })}
            >
              <option value="">Any cuisine</option>
              {unique(lib?.recipes.map((r) => r.cuisine) ?? []).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Difficulty"
              className={selectClass}
              value={f.difficulty}
              onChange={(e) => set({ difficulty: e.target.value })}
            >
              <option value="">Any difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select
              aria-label="Total time"
              className={selectClass}
              value={f.maxMinutes ?? ''}
              onChange={(e) => set({ maxMinutes: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Any time</option>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  Up to {t} min
                </option>
              ))}
            </select>
            {!!lib?.collections.length && (
              <select
                aria-label="Collection"
                className={selectClass}
                value={collectionId}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.value) next.set('collection', e.target.value);
                  else next.delete('collection');
                  setParams(next, { replace: true });
                }}
              >
                <option value="">All collections</option>
                {lib.collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <label className="ml-auto flex items-center gap-2 text-sm font-medium">
              Sort by
              <select
                aria-label="Sort by"
                className={selectClass}
                value={sort}
                onChange={(e) => setSort(e.target.value as RecipeSort)}
              >
                <option value="match">Best match for my pantry</option>
                <option value="name">Name</option>
                <option value="time">Total time</option>
                <option value="favorites">Favourites first</option>
                <option value="recent">Recently cooked</option>
              </select>
            </label>
          </div>
          {(prefs.allergens.length > 0 || prefs.diets.length > 0) && (
            <p className="text-xs text-ink-soft">
              Allergen and diet filters use only the ingredient data and tags saved in this app,
              which can be incomplete. They are a convenience, not medical or safety advice. Always
              check labels.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
            <p aria-live="polite">
              {lib ? `${shown.length} of ${lib.recipes.length} recipes` : 'Loading recipes…'}
            </p>
            <div className="flex flex-wrap gap-4">
              {filtered && (
                <button
                  type="button"
                  onClick={clear}
                  className="min-h-11 font-semibold text-accent-text underline-offset-4 hover:underline"
                >
                  Clear filters
                </button>
              )}
              <Link
                to="/history"
                className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent-text underline-offset-4 hover:underline"
              >
                <History aria-hidden className="size-4" /> Cooking history
              </Link>
              <Link
                to="/collections"
                className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent-text underline-offset-4 hover:underline"
              >
                <Layers aria-hidden className="size-4" /> Collections
              </Link>
            </div>
          </div>
        </Card>

        {lib && shown.length > 0 && (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {shown.map((r) => (
              <li key={r.id}>
                <RecipeCard recipe={r} match={hasStock ? lib.matches.get(r.id) : undefined} />
              </li>
            ))}
          </ul>
        )}
        {lib && shown.length === 0 && (
          <Card>
            <EmptyState
              art={<BookOpen aria-hidden className="size-full text-accent-bright" />}
              title="No recipes match"
              body={
                readyOnly
                  ? 'Nothing in the cookbook is fully covered by your pantry yet. Add ingredients to your pantry, or loosen the filters.'
                  : 'Try a different search or clear the filters.'
              }
              action={
                filtered ? (
                  <button
                    type="button"
                    onClick={clear}
                    className="pp-lift min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          </Card>
        )}
      </div>
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </>
  );
}
