import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileUp } from 'lucide-react';
import { db } from '@/data/db';
import { parseRecipeFile, planImport, recipeIo, type RecipeFile } from '@/data/recipeIo';
import type { Ingredient } from '@/data/types';
import { Button, Dialog, inputClass } from '@/design/ui';
import { useToast } from '@/app/Toast';

/** Paste or choose a PantryPal recipe file, review it, then import as a new personal recipe. */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const ingredients = useLiveQuery(() => db.ingredients.toArray(), [], [] as Ingredient[]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<RecipeFile>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function review(t: string) {
    setText(t);
    setError(undefined);
    setFile(undefined);
    if (!t.trim()) return;
    try {
      setFile(parseRecipeFile(t));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that recipe');
    }
  }
  const unknown = file ? planImport(file, ingredients).unknown : [];

  return (
    <Dialog open onClose={onClose} title="Import a recipe">
      <div className="grid gap-4">
        <p className="text-sm text-ink-soft">
          Choose a recipe file exported from PantryPal, or paste its text. You can review it before
          anything is saved. Nothing is fetched from the internet.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Recipe file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (f.size > 500_000) return setError('That file is too large to be a recipe');
            review(await f.text());
          }}
        />
        <div>
          <Button variant="soft" onClick={() => fileRef.current?.click()}>
            <FileUp aria-hidden className="size-4" /> Choose a file
          </Button>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="imp-text" className="text-sm font-semibold">
            Or paste the recipe text
          </label>
          <textarea
            id="imp-text"
            className={inputClass + ' min-h-28 py-3 font-mono text-sm'}
            value={text}
            onChange={(e) => review(e.target.value)}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-bad-soft px-4 py-2 text-sm font-medium text-bad"
          >
            {error}
          </p>
        )}
        {file && (
          <div className="grid gap-1 rounded-2xl bg-surface-2 p-3" aria-label="Preview">
            <p className="font-semibold">{file.recipe.name}</p>
            <p className="text-sm text-ink-soft">
              {file.recipe.ingredients.length} ingredients · {file.recipe.steps.length} steps ·{' '}
              {file.recipe.servings} servings
            </p>
            {unknown.length > 0 && (
              <p className="text-sm text-warn">
                Not in your ingredient list, will be added as your own: {unknown.join(', ')}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!file || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const id = await recipeIo.importRecipe(file!);
                toast({ message: 'Recipe imported' });
                onClose();
                navigate(`/recipes/${id}`);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not import');
                setBusy(false);
              }
            }}
          >
            Import recipe
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
