import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

/** Chef-hat mark used for the app logo. */
export function Logo(props: P) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <path
        d="M18 30c-6-1-10-6-10-12 0-7 6-12 13-11 3-4 8-6 12-5 4-1 9 1 11 5 7-1 14 4 14 11 0 6-4 10-9 11v13H18V30z"
        fill="#D76543"
      />
      <path
        d="M18 30c0 0 6 3 14 3s14-3 14-3"
        stroke="#FFF9EF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".55"
      />
      <rect x="18" y="42" width="28" height="9" rx="3" fill="#C0502F" />
      <path d="M24 42v9M32 42v9M40 42v9" stroke="#FFF9EF" strokeWidth="1.6" opacity=".45" />
    </svg>
  );
}

export function Sprig(props: P) {
  return (
    <svg viewBox="0 0 80 120" fill="none" aria-hidden="true" {...props}>
      <path d="M40 118C40 80 42 50 46 8" stroke="#5E7355" strokeWidth="3" strokeLinecap="round" />
      {[
        [40, 100, -1],
        [42, 84, 1],
        [40, 68, -1],
        [44, 52, 1],
        [43, 36, -1],
        [46, 20, 1],
      ].map(([x, y, s], i) => (
        <path
          key={i}
          d={`M${x} ${y}c${s * 22}-4 ${s * 30}-18 ${s * 28}-28-${s * 14} 2-${s * 28} 10-${s * 28} 28z`}
          fill={i % 2 ? '#74866B' : '#8FA283'}
        />
      ))}
    </svg>
  );
}

export function Tomato(props: P) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <ellipse cx="32" cy="38" rx="22" ry="20" fill="#D4432A" />
      <ellipse cx="25" cy="30" rx="7" ry="5" fill="#fff" opacity=".22" />
      <path d="M32 18l-8-5 6 1-2-6 6 4 3-5 2 6 6-2-4 6 7 2-9 2z" fill="#5E7355" />
    </svg>
  );
}

export function Basket(props: P) {
  return (
    <svg viewBox="0 0 96 72" fill="none" aria-hidden="true" {...props}>
      <path d="M14 30h68l-8 34a6 6 0 01-6 5H28a6 6 0 01-6-5z" fill="#C99A5B" />
      <path
        d="M20 44h56M23 56h50M34 30l3 38M48 30v39M62 30l-3 38"
        stroke="#A9763A"
        strokeWidth="2"
        opacity=".7"
      />
      <path d="M26 30c0-20 44-20 44 0" stroke="#A9763A" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="38" cy="28" rx="9" ry="8" fill="#D4432A" />
      <ellipse cx="54" cy="26" rx="9" ry="8" fill="#E8B95D" />
      <ellipse cx="47" cy="22" rx="8" ry="7" fill="#74866B" />
    </svg>
  );
}

export function Jar({
  lid = '#C99A5B',
  fill = '#E8B95D',
  ...rest
}: P & { lid?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 40 60" fill="none" aria-hidden="true" {...rest}>
      <rect x="7" y="2" width="26" height="8" rx="3" fill={lid} />
      <path
        d="M9 10h22v6c4 3 5 6 5 10v26a5 5 0 01-5 5H9a5 5 0 01-5-5V26c0-4 1-7 5-10z"
        fill="#FFFDF8"
        stroke="#D9C7A6"
        strokeWidth="2"
      />
      <path d="M7 34h26v18a3 3 0 01-3 3H10a3 3 0 01-3-3z" fill={fill} opacity=".85" />
      <rect x="10" y="22" width="20" height="10" rx="2" fill="#F1E4CE" />
    </svg>
  );
}

/** Soft botanical corner decoration for backgrounds. */
export function BotanicalCorner(props: P) {
  return (
    <svg viewBox="0 0 260 260" fill="none" aria-hidden="true" {...props}>
      <path
        d="M260 0C200 50 140 110 100 260"
        stroke="#5E7355"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".5"
      />
      {[
        [232, 22, 28, -30],
        [205, 52, 30, 10],
        [176, 86, 32, -40],
        [150, 122, 30, 5],
        [126, 164, 30, -35],
        [110, 206, 26, 0],
      ].map(([x, y, s, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`} opacity={0.55}>
          <path
            d={`M0 0c-${s} -6 -${s} -${s} 0 -${s + 6} ${s} 6 ${s} ${s} 0 ${s + 6}z`}
            fill={i % 2 ? '#74866B' : '#8FA283'}
          />
        </g>
      ))}
    </svg>
  );
}

export type Zone = 'pantry' | 'fridge' | 'freezer';

/**
 * Illustrated storage scene. Phase 1 renders empty shelves only: it must never
 * imply stock the user has not logged.
 */
export function StorageScene({ zone, className }: { zone: Zone; className?: string }) {
  const frame = zone === 'pantry' ? '#8A5A32' : '#DCE3E0';
  const inside = zone === 'pantry' ? '#F1E4CE' : zone === 'fridge' ? '#EEF3F1' : '#E1ECF1';
  const shelf = zone === 'pantry' ? '#B07A45' : '#C4CFCB';
  return (
    <svg
      viewBox="0 0 400 220"
      className={className}
      role="img"
      aria-label={`Empty ${zone} shelves`}
    >
      <rect x="6" y="6" width="388" height="208" rx="16" fill={frame} />
      <rect x="18" y="18" width="364" height="184" rx="10" fill={inside} />
      {[78, 138].map((y) => (
        <rect key={y} x="18" y={y} width="364" height="9" fill={shelf} />
      ))}
      <rect x="18" y="195" width="364" height="9" fill={shelf} />
      {zone === 'freezer' && (
        <g stroke="#9DB7C4" strokeWidth="2" strokeLinecap="round" opacity=".7">
          <path d="M60 40l10 10M70 40l-10 10M330 100l10 10M340 100l-10 10M200 160l8 8M208 160l-8 8" />
        </g>
      )}
      {zone === 'pantry' && <Sprig x="318" y="108" width="54" height="80" />}
    </svg>
  );
}
