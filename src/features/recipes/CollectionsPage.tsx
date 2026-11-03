import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { recipes as repo } from '@/data/recipes';
import type { Collection } from '@/data/types';
import { Button, Card, Dialog, EmptyState, inputClass, PageHeader } from '@/design/ui';
import { useToast } from '@/app/Toast';
import { ConfirmDialog } from '../pantry/dialogs';
import { useRecipeLibrary } from './hooks';

function NameDialog({
  title,
  initial,
  label,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  label: string;
  onSave: (name: string) => Promise<void>;
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
            setErr(er instanceof Error ? er.message : 'Could not save');
          }
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="col-name" className="text-sm font-semibold">
            {label}
          </label>
          <input
            id="col-name"
            className={inputClass}
            value={name}
            maxLength={50}
            autoFocus
            aria-invalid={!!err}
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

export function CollectionsPage() {
  const lib = useRecipeLibrary();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Collection>();
  const [deleting, setDeleting] = useState<Collection>();

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle="Group recipes your way."
        back="/more"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-4" /> New collection
          </Button>
        }
      />
      {lib && lib.collections.length === 0 && (
        <Card>
          <EmptyState
            art={<Layers aria-hidden className="size-full text-accent-bright" />}
            title="No collections yet"
            body="Make a collection such as Weeknight dinners, then add recipes to it from any recipe page."
            action={<Button onClick={() => setCreating(true)}>Create a collection</Button>}
          />
        </Card>
      )}
      {lib && lib.collections.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lib.collections.map((c) => {
            const mine = c.recipeIds
              .map((id) => lib.recipes.find((r) => r.id === id))
              .filter((r) => !!r);
            return (
              <li key={c.id}>
                <Card as="div" className="grid h-full content-start gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{c.name}</h2>
                    <p className="text-sm text-ink-soft">
                      {mine.length} {mine.length === 1 ? 'recipe' : 'recipes'}
                    </p>
                  </div>
                  {mine.length > 0 && (
                    <ul className="grid gap-0.5 text-sm" aria-label={`Recipes in ${c.name}`}>
                      {mine.slice(0, 4).map((r) => (
                        <li key={r.id}>
                          <Link
                            to={`/recipes/${r.id}`}
                            className="inline-flex min-h-11 items-center hover:underline"
                          >
                            {r.name}
                          </Link>
                        </li>
                      ))}
                      {mine.length > 4 && (
                        <li className="text-ink-soft">and {mine.length - 4} more</li>
                      )}
                    </ul>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2">
                    {mine.length > 0 && (
                      <Link
                        to={`/recipes?collection=${c.id}`}
                        className="pp-lift inline-flex min-h-11 items-center rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent-text"
                      >
                        Open
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      aria-label={`Rename ${c.name}`}
                      onClick={() => setRenaming(c)}
                    >
                      <Pencil aria-hidden className="size-4" /> Rename
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 aria-hidden className="size-4" /> Delete
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {creating && (
        <NameDialog
          title="New collection"
          initial=""
          label="Name"
          onClose={() => setCreating(false)}
          onSave={async (n) => {
            await repo.createCollection(n);
          }}
        />
      )}
      {renaming && (
        <NameDialog
          title="Rename collection"
          initial={renaming.name}
          label="Name"
          onClose={() => setRenaming(undefined)}
          onSave={(n) => repo.renameCollection(renaming.id, n)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this collection?"
          confirmLabel="Delete collection"
          danger
          onClose={() => setDeleting(undefined)}
          onConfirm={async () => {
            await repo.deleteCollection(deleting.id);
            toast({ message: `Deleted ${deleting.name}. The recipes are still in your cookbook.` });
          }}
        >
          <p>The recipes inside are not deleted.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
