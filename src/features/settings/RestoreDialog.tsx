import { useRef, useState } from 'react';
import { FileUp, ShieldAlert } from 'lucide-react';
import { backup, type BackupFile } from '@/data/backup';
import { errorMessage } from '@/data/errors';
import { Button, Dialog, inputClass, Segmented } from '@/design/ui';
import { useToast } from '@/app/Toast';
import { usePrefs } from '@/app/PrefsProvider';
import { savePrefs } from '@/app/prefs';
import { download } from '@/lib/csv';
import { markBackedUp } from '@/app/backupMeta';

type Preview = Awaited<ReturnType<typeof backup.preview>>;

/** Choose a backup, see exactly what it contains, then merge or replace with confirmation. */
export function RestoreDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { prefs } = usePrefs();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<BackupFile>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load(t: string) {
    setText(t);
    setFile(undefined);
    setPreview(undefined);
    setWarnings([]);
    setError(undefined);
    setSure(false);
    if (!t.trim()) return;
    try {
      const { file: f, warnings: w } = await backup.parseBackup(t);
      setFile(f);
      setWarnings(w);
      setPreview(await backup.preview(f));
    } catch (e) {
      setError(errorMessage(e, 'Could not read that file'));
    }
  }

  async function saveCurrent() {
    try {
      const { text: t } = await backup.exportBackup(prefs);
      download(
        `pantrypal-before-restore-${new Date().toISOString().slice(0, 10)}.json`,
        t,
        'application/json',
      );
      markBackedUp();
      toast({ message: 'Saved a copy of your current data' });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function apply() {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const summary = await backup.restore(file, mode);
      const added = Object.values(summary).reduce((n, s) => n + s.added, 0);
      if (mode === 'replace' && file.data.prefs) {
        savePrefs(file.data.prefs as Parameters<typeof savePrefs>[0]);
        toast({ message: 'Backup restored. Reloading…' });
        setTimeout(() => window.location.assign('/'), 400);
      } else {
        toast({
          message:
            mode === 'merge'
              ? `Merged. Added ${added} record${added === 1 ? '' : 's'}.`
              : 'Backup restored.',
        });
        onClose();
      }
    } catch (e) {
      setError(`${errorMessage(e)} Your existing data was not changed.`);
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Restore from a backup">
      <div className="grid gap-4">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Backup file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (f.size > 80 * 1024 * 1024)
              return setError('That file is too large to be a PantryPal backup');
            await load(await f.text());
          }}
        />
        <div>
          <Button variant="soft" onClick={() => fileRef.current?.click()}>
            <FileUp aria-hidden className="size-4" /> Choose a backup file
          </Button>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="restore-text" className="text-sm font-semibold">
            Or paste the backup text
          </label>
          <textarea
            id="restore-text"
            className={inputClass + ' min-h-20 py-3 font-mono text-xs'}
            value={text}
            onChange={(e) => void load(e.target.value)}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad"
          >
            {error}
          </p>
        )}
        {file && preview && (
          <>
            <div className="grid gap-2 rounded-2xl bg-surface-2 p-3" aria-label="Backup contents">
              <p className="text-sm">
                Made on{' '}
                <strong>
                  {new Date(preview.createdAt).toLocaleString('en', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </strong>{' '}
                with PantryPal {preview.appVersion}. The checksum matched.
              </p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-ink-soft">
                    <th className="py-1 font-semibold">What</th>
                    <th className="py-1 text-right font-semibold">In file</th>
                    <th className="py-1 text-right font-semibold">On this device</th>
                    <th className="py-1 text-right font-semibold">New</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((l) => (
                    <tr key={l.key} className="border-t border-line">
                      <td className="py-1">{l.label}</td>
                      <td className="py-1 text-right tabular-nums">{l.inFile}</td>
                      <td className="py-1 text-right tabular-nums">{l.onDevice}</td>
                      <td className="py-1 text-right tabular-nums">{l.isNew}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {warnings.length > 0 && (
              <ul className="list-disc rounded-2xl bg-warn-soft py-2 pl-8 pr-3 text-sm text-warn">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="grid gap-2">
              <Segmented
                label="How to restore"
                value={mode}
                options={[
                  { value: 'merge', label: 'Add what is missing' },
                  { value: 'replace', label: 'Replace everything' },
                ]}
                onChange={(m) => {
                  setMode(m);
                  setSure(false);
                }}
              />
              <p className="text-sm text-ink-soft">
                {mode === 'merge'
                  ? 'Keeps everything on this device and adds only records it does not already have. Nothing existing is changed.'
                  : 'Removes your current pantry, recipes, plans, lists and history, and puts the backup in their place. Your settings are restored too.'}
              </p>
            </div>
            {mode === 'replace' && (
              <div className="grid gap-2 rounded-2xl border border-bad p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-bad">
                  <ShieldAlert aria-hidden className="size-4" /> This cannot be undone
                </p>
                <div>
                  <Button variant="ghost" onClick={() => void saveCurrent()}>
                    Download a copy of my current data first
                  </Button>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--color-accent)]"
                    checked={sure}
                    onChange={(e) => setSure(e.target.checked)}
                  />
                  I understand my current data will be replaced
                </label>
              </div>
            )}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={mode === 'replace' ? 'danger' : 'primary'}
            disabled={!file || busy || (mode === 'replace' && !sure)}
            onClick={() => void apply()}
          >
            {mode === 'replace' ? 'Replace my data' : 'Add to my data'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
