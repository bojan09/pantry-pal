import { useState } from 'react';
import { errorMessage } from '@/data/errors';
import { planner } from '@/data/planner';
import { Button, Dialog, inputClass } from '@/design/ui';
import { useToast } from '@/app/Toast';
import { addDays, fromISODate, startOfWeek, toISODate, type WeekStart } from '@/lib/dates';

/** Copies every meal of the shown week onto another week: a reusable template week. */
export function CopyWeekDialog({
  fromStart,
  weekStart,
  onClose,
}: {
  fromStart: string;
  weekStart: WeekStart;
  onClose: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(toISODate(addDays(fromISODate(fromStart), 7)));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const target = date ? toISODate(startOfWeek(fromISODate(date), weekStart)) : '';
  return (
    <Dialog open onClose={onClose} title="Copy this week">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const n = await planner.copyWeek(fromStart, target);
            toast({ message: `Copied ${n} meal${n === 1 ? '' : 's'}` });
            onClose();
          } catch (er) {
            setError(errorMessage(er, 'Could not copy the week'));
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-1.5">
          <label htmlFor="copy-date" className="text-sm font-semibold">
            Copy to the week containing
          </label>
          <input
            id="copy-date"
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {target && (
            <p className="text-sm text-ink-soft">
              That week starts on{' '}
              {new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(fromISODate(target))}.
              Meals already there stay; copies are added next to them, not marked done.
            </p>
          )}
        </div>
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
          <Button type="submit" disabled={busy || !date}>
            Copy week
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
