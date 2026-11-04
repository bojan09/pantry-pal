import { useEffect, useState, type ReactNode } from 'react';
import { Download, FileSpreadsheet, HardDrive, Trash2, Upload } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { backup } from '@/data/backup';
import { exportsApi } from '@/data/exports';
import { errorMessage } from '@/data/errors';
import { Button, Card, Dialog, inputClass } from '@/design/ui';
import { useToast } from '@/app/Toast';
import { usePrefs } from '@/app/PrefsProvider';
import { lastBackupAt, markBackedUp } from '@/app/backupMeta';
import { download } from '@/lib/csv';
import { RestoreDialog } from './RestoreDialog';

function Group({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 id={id} className="mb-4 scroll-mt-24 text-xl font-semibold">
        {title}
      </h2>
      <div className="grid gap-4">{children}</div>
    </Card>
  );
}

const stamp = () => new Date().toISOString().slice(0, 10);
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`;

function StorageInfo() {
  const toast = useToast();
  const [est, setEst] = useState<{ usage: number; quota: number }>();
  const [persisted, setPersisted] = useState<boolean>();
  const supported = typeof navigator !== 'undefined' && !!navigator.storage;
  useEffect(() => {
    if (!supported) return;
    void navigator.storage
      .estimate?.()
      .then((e) => setEst({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
    void navigator.storage.persisted?.().then(setPersisted);
  }, [supported]);
  if (!supported)
    return <p className="text-sm text-ink-soft">Your browser does not report storage details.</p>;
  return (
    <div className="grid gap-2 text-sm">
      {est && (
        <p>
          PantryPal is using <strong>{mb(est.usage)}</strong> of roughly {mb(est.quota)} available
          to this site.
        </p>
      )}
      <p className="text-ink-soft">
        {persisted
          ? 'Your browser has agreed to keep this data unless you clear it yourself.'
          : 'Browsers can delete site data when a device runs low on space. Backups are the only real protection.'}
      </p>
      {persisted === false && typeof navigator.storage.persist === 'function' && (
        <div>
          <Button
            variant="ghost"
            onClick={async () => {
              const ok = await navigator.storage.persist();
              setPersisted(ok);
              toast({
                message: ok
                  ? 'Your browser will try to keep this data'
                  : 'Your browser declined. Keep backups.',
              });
            }}
          >
            <HardDrive aria-hidden className="size-4" /> Ask my browser to protect this data
          </Button>
        </div>
      )}
    </div>
  );
}

export function DataSection() {
  const { prefs, reset } = usePrefs();
  const toast = useToast();
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(() => lastBackupAt());
  const lists = useLiveQuery(() => db.shoppingLists.toArray(), [], []);
  const [listId, setListId] = useState('');
  const hasData = useLiveQuery(
    async () =>
      (await db.inventoryLots.count()) + (await db.recipes.filter((r) => !r.isStarter).count()) > 0,
    [],
    false,
  );

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast({ message: `${label}: ${errorMessage(e)}`, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Group id="backup" title="Back up and restore">
        <p className="text-sm text-ink-soft">
          Your data lives only in this browser: no account, no sync. A backup is one file you keep
          wherever you like. It includes your pantry, history, recipes, plans, lists, photos and
          settings, and it is <strong>not encrypted</strong>, so store it somewhere private.
        </p>
        <p className="text-sm font-medium" aria-live="polite">
          {last
            ? `Last backup: ${new Date(last).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}`
            : hasData
              ? 'You have not made a backup yet.'
              : 'Nothing to back up yet.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() =>
              run('Backup failed', async () => {
                const { text } = await backup.exportBackup(prefs);
                download(`pantrypal-backup-${stamp()}.json`, text, 'application/json');
                markBackedUp();
                setLast(Date.now());
                toast({ message: `Backup saved (${mb(text.length)})` });
              })
            }
          >
            <Download aria-hidden className="size-4" /> Download a backup
          </Button>
          <Button variant="ghost" onClick={() => setRestoring(true)}>
            <Upload aria-hidden className="size-4" /> Restore from a backup…
          </Button>
        </div>
      </Group>

      <Group title="Spreadsheets (CSV)">
        <p className="text-sm text-ink-soft">
          Plain tables you can open in Excel, Numbers or Sheets. These are for reading, not for
          restoring.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run('Export failed', async () =>
                download(
                  `pantrypal-pantry-${stamp()}.csv`,
                  await exportsApi.inventoryCsv(),
                  'text/csv',
                ),
              )
            }
          >
            <FileSpreadsheet aria-hidden className="size-4" /> Pantry
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run('Export failed', async () =>
                download(
                  `pantrypal-cooking-history-${stamp()}.csv`,
                  await exportsApi.historyCsv(),
                  'text/csv',
                ),
              )
            }
          >
            <FileSpreadsheet aria-hidden className="size-4" /> Cooking history
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run('Export failed', async () =>
                download(
                  `pantrypal-recipes-${stamp()}.csv`,
                  await exportsApi.recipesCsv(),
                  'text/csv',
                ),
              )
            }
          >
            <FileSpreadsheet aria-hidden className="size-4" /> Recipes
          </Button>
        </div>
        {lists.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1.5">
              <label htmlFor="csv-list" className="text-sm font-semibold">
                Shopping list
              </label>
              <select
                id="csv-list"
                className={inputClass + ' w-auto'}
                value={listId || lists[0].id}
                onChange={(e) => setListId(e.target.value)}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                run('Export failed', async () => {
                  const { name, csv } = await exportsApi.shoppingCsv(listId || lists[0].id);
                  download(
                    `pantrypal-shopping-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${stamp()}.csv`,
                    csv,
                    'text/csv',
                  );
                })
              }
            >
              <FileSpreadsheet aria-hidden className="size-4" /> Export list
            </Button>
          </div>
        )}
      </Group>

      <Group title="Storage">
        <StorageInfo />
      </Group>

      <Group title="Delete my data">
        <p className="text-sm text-ink-soft">
          Removes your pantry, history, recipes, plans, lists, photos and settings from this
          browser. The built-in ingredient list and starter cookbook stay. Download a backup first
          if you might want anything back.
        </p>
        <div>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden className="size-4" /> Delete all my data…
          </Button>
        </div>
      </Group>

      {restoring && <RestoreDialog onClose={() => setRestoring(false)} />}
      {deleting && (
        <Dialog
          open
          onClose={() => {
            setDeleting(false);
            setConfirm('');
          }}
          title="Delete all your data?"
        >
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await backup.wipe();
                reset();
                try {
                  localStorage.removeItem('pantrypal.lastBackup');
                  localStorage.removeItem('pantrypal.backupSnooze');
                } catch {
                  /* ignore */
                }
                toast({ message: 'All your data was deleted' });
                window.location.assign('/');
              } catch (er) {
                toast({ message: errorMessage(er), tone: 'error' });
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-ink-soft">
              This cannot be undone. Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              aria-label="Type DELETE to confirm"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleting(false);
                  setConfirm('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={confirm !== 'DELETE' || busy}>
                Delete everything
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
