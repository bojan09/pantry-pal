import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Camera, ImageOff, Plus, Trash2 } from 'lucide-react';
import { db } from '@/data/db';
import { createInventory } from '@/data/inventory';
import { recipes as repo, type RecipeInput } from '@/data/recipes';
import type { Ingredient } from '@/data/types';
import { Button, Card, EmptyState, Field, inputClass, LinkButton, PageHeader } from '@/design/ui';
import { Tomato } from '@/design/illustrations';
import { usePrefs } from '@/app/PrefsProvider';
import { useToast } from '@/app/Toast';
import { UNITS, unitsForSystem } from '@/domain/units';
import { downscaleImage } from '@/lib/image';
import { newId } from '@/lib/ids';
import { useMediaUrl } from '@/app/useMediaUrl';
import { useRecipeDetail, type RecipeDetail } from './hooks';

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Side'];

interface Line {
  key: string;
  name: string;
  quantity: string;
  unit: string;
  optional: boolean;
}
interface StepRow {
  key: string;
  text: string;
  minutes: string;
}

const blankLine = (unit = 'g'): Line => ({
  key: newId(),
  name: '',
  quantity: '',
  unit,
  optional: false,
});
const blankStep = (): StepRow => ({ key: newId(), text: '', minutes: '' });

const findIngredient = (list: Ingredient[], name: string) => {
  const n = name.trim().toLowerCase();
  return list.find(
    (i) => i.name.toLowerCase() === n || i.aliases.some((a) => a.toLowerCase() === n),
  );
};

export function RecipeFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const { loading, data } = useRecipeDetail(id);
  if (editing && loading) return <PageHeader title="Edit recipe" back="/recipes" />;
  if (editing && !data?.recipe) {
    return (
      <>
        <PageHeader title="Edit recipe" back="/recipes" />
        <Card>
          <EmptyState
            art={<Tomato />}
            title="Recipe not found"
            body="It may have been deleted."
            action={<LinkButton to="/recipes">Back to recipes</LinkButton>}
          />
        </Card>
      </>
    );
  }
  if (editing && data?.recipe?.isStarter) {
    return (
      <>
        <PageHeader title="Edit recipe" back={`/recipes/${id}`} />
        <Card>
          <EmptyState
            art={<Tomato />}
            title="Starter recipes are read-only"
            body="Duplicate it to make your own editable copy."
            action={<LinkButton to={`/recipes/${id}`}>Back to recipe</LinkButton>}
          />
        </Card>
      </>
    );
  }
  return <RecipeForm id={id} data={data} />;
}

function RecipeForm({ id, data }: { id?: string; data?: RecipeDetail }) {
  const editing = !!id;
  const r0 = data?.recipe;
  const { prefs } = usePrefs();
  const toast = useToast();
  const navigate = useNavigate();
  const ingredients = useLiveQuery(
    () => db.ingredients.orderBy('name').toArray(),
    [],
    [] as Ingredient[],
  );
  const listId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(r0?.name ?? '');
  const [summary, setSummary] = useState(r0?.summary ?? '');
  const [cuisine, setCuisine] = useState(r0?.cuisine ?? '');
  const [category, setCategory] = useState(r0?.category ?? 'Dinner');
  const [tags, setTags] = useState(r0?.tags.join(', ') ?? '');
  const [prep, setPrep] = useState(String(r0?.prepMinutes ?? 10));
  const [cook, setCook] = useState(String(r0?.cookMinutes ?? 20));
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(
    r0?.difficulty ?? 'easy',
  );
  const [servings, setServings] = useState(String(r0?.servings ?? 4));
  const [notes, setNotes] = useState(r0?.notes ?? '');
  const [lines, setLines] = useState<Line[]>(() =>
    data && data.lines.length
      ? data.lines.map((l) => ({
          key: l.id,
          name: data.ingredients.get(l.ingredientId)?.name ?? '',
          quantity: String(l.quantity),
          unit: l.unit,
          optional: !!l.optional,
        }))
      : [blankLine(), blankLine(), blankLine()],
  );
  const [steps, setSteps] = useState<StepRow[]>(() =>
    data && data.steps.length
      ? data.steps.map((st) => ({
          key: st.id,
          text: st.text,
          minutes: st.timerSeconds ? String(Math.round((st.timerSeconds / 60) * 100) / 100) : '',
        }))
      : [blankStep(), blankStep()],
  );
  const [imageId, setImageId] = useState<string | undefined>(r0?.imageId);
  const [photo, setPhoto] = useState<{ blob: Blob; width: number; height: number }>();
  const [photoPreview, setPhotoPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const storedUrl = useMediaUrl(imageId);
  const unitOptions = useMemo(() => {
    const base = unitsForSystem(prefs.units);
    const extra = lines
      .map((l) => l.unit)
      .filter((u) => !base.some((b) => b.id === u))
      .flatMap((u) => UNITS.filter((x) => x.id === u));
    return [...base, ...new Set(extra)];
  }, [prefs.units, lines]);

  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  const shownPhoto = photoPreview ?? storedUrl;
  const patchLine = (key: string, p: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const patchStep = (key: string, p: Partial<StepRow>) =>
    setSteps((ss) => ss.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const moveStep = (i: number, d: -1 | 1) =>
    setSteps((ss) => {
      const j = i + d;
      if (j < 0 || j >= ss.length) return ss;
      const copy = [...ss];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const out = await downscaleImage(file, 1200);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhoto(out);
      setPhotoPreview(URL.createObjectURL(out.blob));
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that image.');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    let newAsset: string | undefined;
    try {
      const filled = lines.filter((l) => l.name.trim() || l.quantity.trim());
      // Resolve names to ingredients; unknown names become custom ingredients.
      const inv = createInventory();
      const known = [...ingredients];
      const resolved: RecipeInput['ingredients'] = [];
      const created: string[] = [];
      for (const l of filled) {
        if (!l.name.trim()) throw new Error('Every ingredient row needs a name');
        let ing = findIngredient(known, l.name);
        if (!ing) {
          ing = await inv.createIngredient({
            name: l.name,
            category: 'Other',
            defaultUnit: l.unit,
          });
          known.push(ing);
          created.push(ing.name);
        }
        const q = Number(l.quantity.replace(',', '.'));
        if (!Number.isFinite(q) || q <= 0) throw new Error(`Enter an amount for ${ing.name}`);
        resolved.push({
          ingredientId: ing.id,
          quantity: q,
          unit: l.unit,
          optional: l.optional || undefined,
        });
      }
      const stepRows = steps
        .filter((s) => s.text.trim())
        .map((s) => {
          const m = s.minutes.trim() === '' ? undefined : Number(s.minutes.replace(',', '.'));
          if (m != null && (!Number.isFinite(m) || m <= 0 || m > 1440))
            throw new Error('Timers must be between 1 minute and 24 hours');
          return { text: s.text, timerSeconds: m ? Math.round(m * 60) : undefined };
        });
      let finalImage = imageId;
      if (photo) {
        newAsset = newId();
        await db.mediaAssets.add({
          id: newAsset,
          kind: 'recipe',
          mime: 'image/jpeg',
          width: photo.width,
          height: photo.height,
          blob: photo.blob,
          createdAt: Date.now(),
        });
        finalImage = newAsset;
      }
      const rid = await repo.saveRecipe(
        {
          name,
          summary,
          cuisine: cuisine.trim() || undefined,
          category,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          prepMinutes: Number(prep) || 0,
          cookMinutes: Number(cook) || 0,
          difficulty,
          servings: Number(servings),
          notes: notes.trim() || undefined,
          imageId: finalImage,
          art: data?.recipe?.art,
          ingredients: resolved,
          steps: stepRows,
        },
        id,
      );
      toast({
        message: created.length
          ? `Saved. Added ${created.length} new ingredient${created.length > 1 ? 's' : ''}: ${created.join(', ')}`
          : 'Recipe saved',
      });
      navigate(`/recipes/${rid}`);
    } catch (err) {
      if (newAsset) await db.mediaAssets.delete(newAsset).catch(() => undefined);
      setError(err instanceof Error ? err.message : 'Could not save the recipe');
      document.getElementById('form-error')?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={editing ? 'Edit recipe' : 'New recipe'}
        subtitle="Saved only on this device."
        back={editing ? `/recipes/${id}` : '/recipes'}
      />
      <form onSubmit={submit} className="grid gap-5" noValidate>
        {error && (
          <p
            id="form-error"
            tabIndex={-1}
            role="alert"
            className="rounded-2xl bg-bad-soft px-4 py-3 font-medium text-bad"
          >
            {error}
          </p>
        )}
        <Card className="grid gap-4">
          <h2 className="text-2xl font-semibold">Basics</h2>
          <Field label="Name">
            {(fid) => (
              <input
                id={fid}
                className={inputClass}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <Field label="Short description (optional)">
            {(fid) => (
              <textarea
                id={fid}
                className={inputClass + ' min-h-20 py-3'}
                value={summary}
                maxLength={300}
                onChange={(e) => setSummary(e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              {(fid) => (
                <select
                  id={fid}
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
            <Field label="Cuisine (optional)">
              {(fid) => (
                <input
                  id={fid}
                  className={inputClass}
                  value={cuisine}
                  maxLength={40}
                  onChange={(e) => setCuisine(e.target.value)}
                />
              )}
            </Field>
            <Field label="Prep time (minutes)">
              {(fid) => (
                <input
                  id={fid}
                  inputMode="numeric"
                  className={inputClass}
                  value={prep}
                  onChange={(e) => setPrep(e.target.value)}
                />
              )}
            </Field>
            <Field label="Cooking time (minutes)">
              {(fid) => (
                <input
                  id={fid}
                  inputMode="numeric"
                  className={inputClass}
                  value={cook}
                  onChange={(e) => setCook(e.target.value)}
                />
              )}
            </Field>
            <Field label="Servings">
              {(fid) => (
                <input
                  id={fid}
                  inputMode="numeric"
                  className={inputClass}
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                />
              )}
            </Field>
            <Field label="Difficulty">
              {(fid) => (
                <select
                  id={fid}
                  className={inputClass}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              )}
            </Field>
          </div>
          <Field label="Tags (comma separated)" hint="For example: vegetarian, quick, kids">
            {(fid) => (
              <input
                id={fid}
                className={inputClass}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            )}
          </Field>
        </Card>

        <Card className="grid gap-3">
          <h2 className="text-2xl font-semibold">Photo</h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid aspect-[4/3] w-40 place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2">
              {shownPhoto ? (
                <img src={shownPhoto} alt="Recipe preview" className="size-full object-cover" />
              ) : (
                <ImageOff aria-hidden className="size-8 text-ink-soft" />
              )}
            </div>
            <div className="grid gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Recipe photo file"
                onChange={(e) => {
                  void onPickPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button variant="soft" onClick={() => fileRef.current?.click()}>
                <Camera aria-hidden className="size-4" />{' '}
                {shownPhoto ? 'Replace photo' : 'Add a photo'}
              </Button>
              {shownPhoto && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPhoto(undefined);
                    setPhotoPreview(undefined);
                    setImageId(undefined);
                  }}
                >
                  Remove photo
                </Button>
              )}
              <p className="max-w-xs text-sm text-ink-soft">
                Stays on this device and is resized. Without one, an illustration is used.
              </p>
            </div>
          </div>
        </Card>

        <Card className="grid gap-3">
          <h2 className="text-2xl font-semibold">Ingredients</h2>
          <datalist id={listId}>
            {ingredients.map((i) => (
              <option key={i.id} value={i.name} />
            ))}
          </datalist>
          <ul className="grid gap-3">
            {lines.map((l, i) => (
              <li
                key={l.key}
                className="grid grid-cols-[minmax(0,1fr)_5.5rem_7.5rem] gap-2 rounded-2xl bg-surface-2 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto_auto]"
              >
                <input
                  aria-label={`Ingredient ${i + 1} name`}
                  list={listId}
                  placeholder="Ingredient"
                  className={inputClass + ' col-span-3 sm:col-span-1'}
                  value={l.name}
                  onChange={(e) => patchLine(l.key, { name: e.target.value })}
                />
                <input
                  aria-label={`Ingredient ${i + 1} amount`}
                  inputMode="decimal"
                  placeholder="Amount"
                  className={inputClass}
                  value={l.quantity}
                  onChange={(e) => patchLine(l.key, { quantity: e.target.value })}
                />
                <select
                  aria-label={`Ingredient ${i + 1} unit`}
                  className={inputClass}
                  value={l.unit}
                  onChange={(e) => patchLine(l.key, { unit: e.target.value })}
                >
                  {unitOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--color-accent)]"
                    checked={l.optional}
                    onChange={(e) => patchLine(l.key, { optional: e.target.checked })}
                  />
                  Optional
                </label>
                <button
                  type="button"
                  aria-label={`Remove ingredient ${i + 1}`}
                  onClick={() =>
                    setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))
                  }
                  className="pp-lift grid size-11 place-items-center rounded-full border border-line bg-surface"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <div>
            <Button
              variant="soft"
              onClick={() => setLines((ls) => [...ls, blankLine(ls.at(-1)?.unit)])}
            >
              <Plus aria-hidden className="size-4" /> Add ingredient
            </Button>
          </div>
          <p className="text-sm text-ink-soft">
            Type to pick from the ingredient list. A name that is not in the list is added as your
            own ingredient when you save.
          </p>
        </Card>

        <Card className="grid gap-3">
          <h2 className="text-2xl font-semibold">Steps</h2>
          <ol className="grid gap-3">
            {steps.map((s, i) => (
              <li key={s.key} className="grid gap-2 rounded-2xl bg-surface-2 p-3">
                <textarea
                  aria-label={`Step ${i + 1}`}
                  className={inputClass + ' min-h-20 py-3'}
                  placeholder={`Step ${i + 1}`}
                  value={s.text}
                  maxLength={1000}
                  onChange={(e) => patchStep(s.key, { text: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`Step ${i + 1} timer in minutes`}
                    inputMode="decimal"
                    placeholder="Timer (min)"
                    className={inputClass + ' w-36'}
                    value={s.minutes}
                    onChange={(e) => patchStep(s.key, { minutes: e.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={`Move step ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => moveStep(i, -1)}
                    className="pp-lift grid size-11 place-items-center rounded-full border border-line bg-surface disabled:opacity-40"
                  >
                    <ArrowUp aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move step ${i + 1} down`}
                    disabled={i === steps.length - 1}
                    onClick={() => moveStep(i, 1)}
                    className="pp-lift grid size-11 place-items-center rounded-full border border-line bg-surface disabled:opacity-40"
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove step ${i + 1}`}
                    onClick={() =>
                      setSteps((ss) => (ss.length > 1 ? ss.filter((x) => x.key !== s.key) : ss))
                    }
                    className="pp-lift ml-auto grid size-11 place-items-center rounded-full border border-line bg-surface"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div>
            <Button variant="soft" onClick={() => setSteps((ss) => [...ss, blankStep()])}>
              <Plus aria-hidden className="size-4" /> Add step
            </Button>
          </div>
        </Card>

        <Card className="grid gap-3">
          <Field label="Notes (optional)">
            {(fid) => (
              <textarea
                id={fid}
                className={inputClass + ' min-h-24 py-3'}
                value={notes}
                maxLength={2000}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
          </Field>
        </Card>

        <div className="flex justify-end gap-2">
          <LinkButton variant="ghost" to={editing ? `/recipes/${id}` : '/recipes'}>
            Cancel
          </LinkButton>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save recipe'}
          </Button>
        </div>
      </form>
    </>
  );
}
