import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChefHat,
  Copy,
  Layers,
  Minus,
  Pencil,
  Play,
  Plus,
  Timer,
  Trash2,
} from 'lucide-react';
import { Tomato } from '@/design/illustrations';
import { Button, Card, Dialog, EmptyState, inputClass, LinkButton, PageHeader } from '@/design/ui';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { recipes as repo } from '@/data/recipes';
import type { Collection } from '@/data/types';
import { groupLots, recipeAvailability, totalMinutes } from '@/domain/recipes';
import { clampServings, formatAmount, isNonLinear } from '@/domain/scaling';
import { ConfirmDialog } from '../pantry/dialogs';
import { FavoriteButton } from './RecipeCard';
import { RecipeArt } from './RecipeArt';
import { useRecipeDetail } from './hooks';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

function CollectionsDialog({
  recipeId,
  collections,
  onClose,
}: {
  recipeId: string;
  collections: Collection[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [err, setErr] = useState<string>();
  return (
    <Dialog open onClose={onClose} title="Add to collection">
      <div className="grid gap-4">
        {collections.length ? (
          <ul className="grid gap-1" aria-label="Collections">
            {collections.map((c) => {
              const on = c.recipeIds.includes(recipeId);
              return (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--color-accent)]"
                      checked={on}
                      onChange={(e) =>
                        repo
                          .setInCollection(c.id, recipeId, e.target.checked)
                          .catch((er: unknown) => toast({ message: errMsg(er), tone: 'error' }))
                      }
                    />
                    {c.name}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-ink-soft">No collections yet. Create your first one below.</p>
        )}
        <div className="grid gap-1.5">
          <label htmlFor="new-col" className="text-sm font-semibold">
            New collection
          </label>
          <div className="flex gap-2">
            <input
              id="new-col"
              className={inputClass}
              placeholder="e.g. Weeknight dinners"
              value={name}
              maxLength={50}
              onChange={(e) => {
                setName(e.target.value);
                setErr(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget.nextElementSibling as HTMLButtonElement | null)?.click();
                }
              }}
            />
            <Button
              variant="soft"
              onClick={async () => {
                try {
                  const c = await repo.createCollection(name);
                  await repo.setInCollection(c.id, recipeId, true);
                  setName('');
                } catch (e) {
                  setErr(errMsg(e));
                }
              }}
            >
              Create
            </Button>
          </div>
          {err && (
            <p role="alert" className="text-sm font-medium text-bad">
              {err}
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}

export function RecipeDetailPage() {
  const { id } = useParams();
  const { loading, data } = useRecipeDetail(id);
  const { prefs } = usePrefs();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const recipe = data?.recipe;
  const servings = recipe ? clampServings(Number(params.get('servings')) || recipe.servings) : 1;
  const factor = recipe ? servings / recipe.servings : 1;

  const avail = useMemo(
    () =>
      data && recipe
        ? recipeAvailability(data.lines, factor, groupLots(data.lots), data.ingredients)
        : undefined,
    [data, recipe, factor],
  );

  if (loading) return <PageHeader title="Recipe" back="/recipes" />;
  if (!data || !recipe || !avail) {
    return (
      <>
        <PageHeader title="Recipe" back="/recipes" />
        <Card>
          <EmptyState
            art={<Tomato />}
            title="Recipe not found"
            body={`There is no recipe with id "${id ?? ''}" on this device.`}
            action={<LinkButton to="/recipes">Back to recipes</LinkButton>}
          />
        </Card>
      </>
    );
  }

  const setServings = (n: number) => {
    const next = new URLSearchParams(params);
    next.set('servings', String(clampServings(n)));
    setParams(next, { replace: true });
  };
  const active = data.sessions.find((s) => s.status === 'active');
  const done = data.sessions.filter((s) => s.status === 'completed');
  const lastDone = done.reduce<number | undefined>(
    (m, s) => Math.max(m ?? 0, s.finishedAt ?? s.startedAt),
    undefined,
  );
  const mins = totalMinutes(recipe);
  const scaled = factor !== 1;
  const inCollections = data.collections.filter((c) => c.recipeIds.includes(recipe.id));
  const cookTo = `/recipes/${recipe.id}/cook?servings=${servings}`;

  return (
    <>
      <PageHeader
        title={recipe.name}
        subtitle={recipe.summary}
        back="/recipes"
        actions={<FavoriteButton recipe={recipe} className="border border-line" />}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <RecipeArt recipe={recipe} className="aspect-[4/3] rounded-3xl border border-line" />
          <Card className="grid gap-3">
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Prep', `${recipe.prepMinutes} min`],
                ['Cook', `${recipe.cookMinutes} min`],
                ['Level', recipe.difficulty],
              ].map(([l, v]) => (
                <div key={l} className="rounded-2xl bg-surface-2 px-2 py-2">
                  <dd className="font-display text-lg font-semibold capitalize">{v}</dd>
                  <dt className="text-xs text-ink-soft">{l}</dt>
                </div>
              ))}
            </dl>
            <p className="text-sm text-ink-soft">
              {mins > 0 ? `${mins} minutes in total` : 'No cooking needed'}
              {recipe.cuisine ? ` · ${recipe.cuisine}` : ''}
              {recipe.category ? ` · ${recipe.category}` : ''}
            </p>
            {recipe.tags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
                {recipe.tags.map((t) => (
                  <li
                    key={t}
                    className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-text"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {done.length > 0 && (
              <p className="text-sm text-ink-soft">
                Cooked {done.length} {done.length === 1 ? 'time' : 'times'}
                {lastDone
                  ? `, last on ${new Date(lastDone).toLocaleDateString('en', { dateStyle: 'medium' })}`
                  : ''}
                .
              </p>
            )}
            {inCollections.length > 0 && (
              <p className="text-sm text-ink-soft">
                In{' '}
                {inCollections.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ', '}
                    <Link
                      to={`/recipes?collection=${c.id}`}
                      className="font-semibold text-accent-text underline-offset-4 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </Card>
          <div className="grid gap-2">
            <LinkButton to={cookTo} className="min-h-14 text-base">
              <Play aria-hidden className="size-5" /> {active ? 'Resume cooking' : 'Start cooking'}
            </LinkButton>
            {active && (
              <p className="text-sm text-ink-soft">
                You have an unfinished session from{' '}
                {new Date(active.startedAt).toLocaleString('en', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                .
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setCollectionsOpen(true)}>
                <Layers aria-hidden className="size-4" /> Collections
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    const copy = await repo.duplicateRecipe(recipe.id);
                    toast({ message: 'Copied. You can edit your copy.' });
                    navigate(`/recipes/${copy}/edit`);
                  } catch (e) {
                    toast({ message: errMsg(e), tone: 'error' });
                  }
                }}
              >
                <Copy aria-hidden className="size-4" /> Duplicate
              </Button>
              {!recipe.isStarter && (
                <>
                  <LinkButton variant="ghost" to={`/recipes/${recipe.id}/edit`}>
                    <Pencil aria-hidden className="size-4" /> Edit
                  </LinkButton>
                  <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                    <Trash2 aria-hidden className="size-4" /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid content-start gap-5">
          <Card aria-labelledby="ing-h">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="ing-h" className="text-2xl font-semibold">
                Ingredients
              </h2>
              <div className="flex items-center gap-2" role="group" aria-label="Servings">
                <button
                  type="button"
                  aria-label="Fewer servings"
                  disabled={servings <= 1}
                  onClick={() => setServings(servings - 1)}
                  className="pp-lift grid size-11 place-items-center rounded-full border border-line bg-surface disabled:opacity-40"
                >
                  <Minus aria-hidden className="size-4" />
                </button>
                <span aria-live="polite" className="min-w-24 text-center font-semibold">
                  {servings} {servings === 1 ? 'serving' : 'servings'}
                </span>
                <button
                  type="button"
                  aria-label="More servings"
                  disabled={servings >= 100}
                  onClick={() => setServings(servings + 1)}
                  className="pp-lift grid size-11 place-items-center rounded-full border border-line bg-surface disabled:opacity-40"
                >
                  <Plus aria-hidden className="size-4" />
                </button>
              </div>
            </div>
            {scaled && (
              <p className="mt-2 text-sm text-ink-soft">
                Scaled from {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}.
                Amounts marked ≈ (spices, salt, leavening) and cooking times do not always scale in
                a straight line, so taste and adjust.{' '}
                <button
                  type="button"
                  className="font-semibold text-accent-text underline-offset-4 hover:underline"
                  onClick={() => setServings(recipe.servings)}
                >
                  Reset
                </button>
              </p>
            )}
            <p className="mt-2 text-sm font-medium" aria-live="polite">
              {avail.total === 0
                ? ''
                : avail.ready
                  ? 'Your pantry covers every required ingredient.'
                  : `Your pantry covers ${avail.have} of ${avail.total} required ingredients.`}
            </p>
            <ul className="mt-3 divide-y divide-line">
              {avail.lines.map(({ line, needed, status, available }) => {
                const ing = data.ingredients.get(line.ingredientId);
                const approx = ing ? isNonLinear(ing.category, ing.name) && scaled : false;
                return (
                  <li key={line.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="min-w-28 font-semibold tabular-nums">
                      {approx && <span title="Estimate: adjust to taste">≈ </span>}
                      {formatAmount(needed, line.unit, prefs.units)}
                    </span>
                    <span className="flex-1">
                      {ing ? (
                        <Link to={`/pantry/${ing.id}`} className="hover:underline">
                          {ing.name}
                        </Link>
                      ) : (
                        'Unknown ingredient'
                      )}
                      {line.optional && <span className="text-ink-soft"> (optional)</span>}
                    </span>
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                        status === 'enough'
                          ? 'bg-good-soft text-good'
                          : status === 'missing'
                            ? 'bg-bad-soft text-bad'
                            : 'bg-warn-soft text-warn'
                      }`}
                    >
                      {status === 'enough' && (
                        <>
                          <Check aria-hidden className="mr-1 inline size-3" />
                          In pantry
                        </>
                      )}
                      {status === 'short' &&
                        `Have ${formatAmount(available ?? 0, line.unit, prefs.units)}`}
                      {status === 'missing' && 'Not in pantry'}
                      {status === 'unit' && 'Check units'}
                    </span>
                  </li>
                );
              })}
            </ul>
            {avail.lines.some((l) => l.status === 'unit') && (
              <p className="mt-2 text-sm text-ink-soft">
                &ldquo;Check units&rdquo; means you track this ingredient in a unit that cannot be
                compared safely with the recipe (for example a jar versus teaspoons). Nothing is
                guessed.
              </p>
            )}
          </Card>

          <Card aria-labelledby="steps-h">
            <h2 id="steps-h" className="text-2xl font-semibold">
              Method
            </h2>
            <ol className="mt-3 grid gap-4">
              {data.steps.map((s, i) => (
                <li key={s.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft font-display font-semibold text-accent-text"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p>{s.text}</p>
                    {s.timerSeconds && (
                      <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-ink-soft">
                        <Timer aria-hidden className="size-4" />
                        About {Math.round(s.timerSeconds / 60)} min
                        {scaled && ' (may differ at this size)'}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {recipe.notes && (
            <Card aria-labelledby="notes-h">
              <h2 id="notes-h" className="text-2xl font-semibold">
                Notes
              </h2>
              <p className="mt-2 whitespace-pre-line text-ink-soft">{recipe.notes}</p>
            </Card>
          )}
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <ChefHat aria-hidden className="size-4" />
            Allergen and diet tags are informational and depend on what you enter.
          </p>
        </div>
      </div>
      {collectionsOpen && (
        <CollectionsDialog
          recipeId={recipe.id}
          collections={data.collections}
          onClose={() => setCollectionsOpen(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this recipe?"
          confirmLabel="Delete recipe"
          danger
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await repo.deleteRecipe(recipe.id);
              toast({ message: `Deleted ${recipe.name}` });
              navigate('/recipes');
            } catch (e) {
              toast({ message: errMsg(e), tone: 'error' });
            }
          }}
        >
          <p>
            &ldquo;{recipe.name}&rdquo; and its steps will be removed from this device. Your cooking
            history and pantry are not affected.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
