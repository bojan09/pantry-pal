import { useId } from 'react';
import type { Slice } from '@/domain/analytics';

const COLORS = [
  'var(--color-accent)',
  'var(--color-sage)',
  'var(--color-saffron)',
  '#8a6a4f',
  '#b5656b',
  '#5f7f8c',
  '#a7a15a',
  '#7d6aa0',
];

/** Horizontal bars with the number written out, so the chart is also plain text. */
export function BarList({
  rows,
  unit = '',
  color = 'var(--color-accent)',
  label,
}: {
  rows: Slice[];
  unit?: string;
  color?: string;
  label: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="grid gap-2">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[minmax(7rem,38%)_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="truncate">{r.label}</span>
          <span aria-hidden className="h-3 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, background: color }}
            />
          </span>
          <span className="min-w-8 text-right font-display text-lg font-semibold tabular-nums">
            {r.value}
            {unit && <span className="ml-0.5 text-xs font-sans text-ink-soft">{unit}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Ring chart with a legend that carries the same numbers. */
export function Donut({
  slices,
  label,
  centre,
}: {
  slices: Slice[];
  label: string;
  centre: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  const offsets = slices.map((_, i) =>
    slices.slice(0, i).reduce((a, x) => a + (x.value / total) * c, 0),
  );
  const titleId = useId();
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[10rem_1fr]">
      <svg viewBox="0 0 120 120" role="img" aria-labelledby={titleId} className="mx-auto size-40">
        <title
          id={titleId}
        >{`${label}: ${slices.map((s) => `${s.label} ${s.value}`).join(', ')}`}</title>
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="16"
        />
        {slices.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offsets[i]}
              transform="rotate(-90 60 60)"
            />
          );
          return el;
        })}
        <text
          x="60"
          y="58"
          textAnchor="middle"
          className="fill-ink font-display text-[22px] font-semibold"
        >
          {total}
        </text>
        <text x="60" y="73" textAnchor="middle" className="fill-ink-soft text-[8px]">
          {centre}
        </text>
      </svg>
      <ul className="grid gap-1.5 text-sm" aria-label={`${label} legend`}>
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="flex-1 truncate">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value}</span>
            <span className="w-10 text-right text-ink-soft tabular-nums">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical columns, one per period, with a text table behind a disclosure. */
export function Columns({ rows, label, unit }: { rows: Slice[]; label: string; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const w = 28;
  const gap = 10;
  const width = rows.length * (w + gap) + gap;
  const titleId = useId();
  return (
    <div className="grid gap-2">
      <svg
        viewBox={`0 0 ${width} 100`}
        role="img"
        aria-labelledby={titleId}
        className="h-44 w-full"
      >
        <title
          id={titleId}
        >{`${label}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`}</title>
        {rows.map((r, i) => {
          const h = (r.value / max) * 70;
          const x = gap + i * (w + gap);
          return (
            <g key={r.label + i}>
              <rect
                x={x}
                y={78 - h}
                width={w}
                height={Math.max(h, 1.5)}
                rx="5"
                fill={r.value ? 'var(--color-accent)' : 'var(--color-line)'}
              />
              <text
                x={x + w / 2}
                y={73 - h}
                textAnchor="middle"
                className="fill-ink text-[8px] font-semibold"
              >
                {r.value || ''}
              </text>
              <text x={x + w / 2} y="92" textAnchor="middle" className="fill-ink-soft text-[6px]">
                {r.label}
              </text>
            </g>
          );
        })}
      </svg>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-accent-text">
          View as table
        </summary>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-semibold">Week starting</th>
              <th className="py-1 text-right font-semibold">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label + i} className="border-t border-line">
                <td className="py-1">{r.label}</td>
                <td className="py-1 text-right tabular-nums">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
