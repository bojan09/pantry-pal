import { Zap } from 'lucide-react';

export function MatchPill({ have, total }: { have: number; total: number }) {
  const all = total > 0 && have >= total;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${all ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn'}`}
    >
      <Zap aria-hidden className="size-3.5" />
      {all ? 'You have everything' : `You have ${have}/${total} ingredients`}
    </span>
  );
}

export function SampleBanner({ children }: { children?: string }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-line bg-warn-soft px-4 py-2 text-sm font-medium text-warn">
      <span className="rounded-full bg-warn px-2 py-0.5 text-xs font-bold text-warn-soft">
        SAMPLE
      </span>
      {children ?? 'Sample meal plan. Turn off in Settings.'}
    </p>
  );
}
