import { Link } from 'react-router-dom';
import { Heart, Zap } from 'lucide-react';
import { Art } from '@/design/illustrations';
import type { SampleRecipe } from './sample';

export function MatchPill({ have, total }: { have: number; total: number }) {
  const all = have >= total;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${all ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn'}`}
    >
      <Zap aria-hidden className="size-3.5" />
      {all ? 'You have everything!' : `You have ${have}/${total} ingredients`}
    </span>
  );
}

/** Illustrated recipe card; `sample` recipes are labelled by the page banner. */
export function RecipeCard({ r }: { r: SampleRecipe }) {
  return (
    <Link
      to={`/recipes/${r.id}`}
      className="pp-card group grid gap-3 overflow-hidden p-0 transition hover:-translate-y-0.5"
    >
      <div className="relative grid aspect-[4/3] place-items-center bg-gradient-to-br from-oat to-surface-2">
        <Art name={r.art} className="h-[88%] drop-shadow-md" />
        <span
          aria-hidden
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-surface/90 text-accent-bright shadow"
        >
          <Heart className="size-4 fill-current" />
        </span>
      </div>
      <div className="grid gap-1 px-4 pb-4">
        <h3 className="font-display text-lg font-semibold leading-tight">{r.name}</h3>
        <p className="text-sm text-ink-soft">
          {r.minutes} min · {r.difficulty}
        </p>
        <div className="mt-1">
          <MatchPill have={r.have} total={r.total} />
        </div>
      </div>
    </Link>
  );
}

export function SampleBanner() {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-line bg-warn-soft px-4 py-2 text-sm font-medium text-warn">
      <span className="rounded-full bg-warn px-2 py-0.5 text-xs font-bold text-warn-soft">
        SAMPLE
      </span>
      Illustrative content. Turn off in Settings.
    </p>
  );
}
