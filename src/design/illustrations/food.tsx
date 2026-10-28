import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const plate = (
  <>
    <circle cx="60" cy="60" r="56" fill="#FFFDF8" />
    <circle cx="60" cy="60" r="56" fill="none" stroke="#E6D8BF" strokeWidth="3" />
    <circle cx="60" cy="60" r="45" fill="none" stroke="#F1E4CE" strokeWidth="2" />
  </>
);
const Wrap = ({ children, ...p }: P) => (
  <svg viewBox="0 0 120 120" aria-hidden="true" {...p}>
    {children}
  </svg>
);

export const PastaArt = (p: P) => (
  <Wrap {...p}>
    {plate}
    <circle cx="60" cy="60" r="34" fill="#E8B95D" />
    {[28, 24, 20, 16, 12].map((r, i) => (
      <circle
        key={r}
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={i % 2 ? '#F2CB73' : '#E0A941'}
        strokeWidth="4"
      />
    ))}
    <circle cx="60" cy="58" r="17" fill="#D4432A" opacity=".92" />
    {[
      [52, 54],
      [64, 52],
      [58, 64],
      [68, 62],
      [50, 63],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="3.5" fill="#B83320" />
    ))}
    <path d="M60 44c8-2 12 4 8 9-6 0-10-3-8-9z" fill="#5E7355" />
    <path d="M48 50c-6 0-9 5-6 9 5 0 8-4 6-9z" fill="#74866B" />
    {[
      [70, 70],
      [46, 68],
      [62, 36],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="1.6" fill="#FFF9EF" />
    ))}
  </Wrap>
);

export const FrittataArt = (p: P) => (
  <Wrap {...p}>
    {plate}
    <circle cx="60" cy="60" r="38" fill="#F1C24F" />
    <circle cx="60" cy="60" r="38" fill="none" stroke="#C98F24" strokeWidth="4" />
    {[
      [46, 48, '#D4432A'],
      [70, 46, '#74866B'],
      [60, 64, '#D4432A'],
      [44, 70, '#5E7355'],
      [76, 68, '#E8782B'],
      [58, 40, '#74866B'],
    ].map(([x, y, c], i) => (
      <circle key={i} cx={x as number} cy={y as number} r="5" fill={c as string} />
    ))}
    <path d="M60 22v76M22 60h76" stroke="#C98F24" strokeWidth="1.6" opacity=".45" />
  </Wrap>
);

export const CurryArt = (p: P) => (
  <Wrap {...p}>
    <circle cx="60" cy="60" r="56" fill="#3A302A" />
    <circle cx="60" cy="60" r="48" fill="#2A221E" />
    <circle cx="60" cy="60" r="42" fill="#E07B24" />
    <circle cx="60" cy="60" r="30" fill="#EC8F2E" opacity=".8" />
    {[
      [48, 52],
      [62, 46],
      [72, 60],
      [56, 68],
      [44, 66],
      [66, 74],
      [78, 50],
      [54, 56],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="5" fill="#E8C27A" stroke="#C99A4A" strokeWidth="1.2" />
    ))}
    {[
      [40, 50],
      [74, 66],
      [60, 40],
    ].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y}c4-5 9-3 8 2-4 3-8 2-8-2z`} fill="#5E7355" />
    ))}
  </Wrap>
);

export const PancakesArt = (p: P) => (
  <Wrap {...p}>
    {plate}
    <ellipse cx="60" cy="82" rx="34" ry="8" fill="#000" opacity=".08" />
    {[74, 62, 50].map((y, i) => (
      <g key={y}>
        <ellipse cx="60" cy={y + 6} rx="32" ry="10" fill="#B77B34" />
        <ellipse cx="60" cy={y} rx="32" ry="10" fill={i === 2 ? '#E2A956' : '#D49A47'} />
      </g>
    ))}
    <ellipse cx="60" cy="46" rx="22" ry="6" fill="#B8692A" opacity=".85" />
    <path d="M44 48c0 8 2 14 4 16" stroke="#B8692A" strokeWidth="4" strokeLinecap="round" />
    <circle cx="56" cy="38" r="6" fill="#B03A55" />
    <circle cx="68" cy="40" r="5.5" fill="#7E3A8C" />
    <circle cx="62" cy="33" r="5" fill="#B03A55" />
    <rect x="70" y="30" width="9" height="7" rx="1.5" fill="#F7E7A6" />
  </Wrap>
);

export const BowlArt = (p: P) => (
  <Wrap {...p}>
    {plate}
    <circle cx="60" cy="60" r="38" fill="#F1E4CE" />
    <path d="M60 60L60 22A38 38 0 0 1 93 41z" fill="#8FA283" />
    <path d="M60 60L93 41A38 38 0 0 1 93 79z" fill="#E8B95D" />
    <path d="M60 60L93 79A38 38 0 0 1 60 98z" fill="#D4432A" />
    <path d="M60 60L60 98A38 38 0 0 1 27 79z" fill="#EFE3C8" />
    <path d="M60 60L27 79A38 38 0 0 1 27 41z" fill="#C0582F" />
    <path d="M60 60L27 41A38 38 0 0 1 60 22z" fill="#74866B" />
    {[
      [50, 40],
      [76, 50],
      [74, 72],
      [48, 76],
      [40, 56],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="3" fill="#FFF9EF" opacity=".5" />
    ))}
  </Wrap>
);

export const SaladArt = (p: P) => (
  <Wrap {...p}>
    {plate}
    <circle cx="60" cy="60" r="38" fill="#74866B" />
    {[
      [40, 46, -20],
      [60, 38, 10],
      [78, 50, 30],
      [44, 72, 200],
      [72, 76, 160],
      [60, 60, 90],
    ].map(([x, y, r], i) => (
      <path
        key={i}
        d="M0 0c-14-4-16-18 0-22 14 4 14 18 0 22z"
        transform={`translate(${x} ${y}) rotate(${r})`}
        fill={i % 2 ? '#5E7355' : '#9DB38F'}
      />
    ))}
    {[
      [50, 58],
      [68, 64],
      [60, 48],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="6" fill="#D4432A" />
    ))}
    <circle cx="74" cy="48" r="4.5" fill="#E8B95D" />
    <circle cx="46" cy="66" r="4" fill="#F5EEDC" />
  </Wrap>
);

export const SoupArt = (p: P) => (
  <Wrap {...p}>
    <circle cx="60" cy="60" r="56" fill="#9A4A2F" />
    <circle cx="60" cy="60" r="48" fill="#FFFDF8" />
    <circle cx="60" cy="60" r="38" fill="#D8592B" />
    <circle cx="60" cy="60" r="26" fill="#E26B36" opacity=".8" />
    <path
      d="M42 62c8-12 14 6 22-6s10 4 14-2"
      stroke="#FFF4DD"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="68" cy="50" r="3" fill="#5E7355" />
    <circle cx="50" cy="72" r="2.6" fill="#5E7355" />
    <circle cx="74" cy="68" r="2.4" fill="#F1E4CE" />
  </Wrap>
);

export const MilkArt = (p: P) => (
  <Wrap {...p}>
    <path
      d="M38 22h44l10 22v62H28V44z"
      fill="#F7F4EC"
      stroke="#CFC8B8"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M38 22h44l-8 22H46z" fill="#DDE6EC" />
    <rect x="40" y="58" width="40" height="30" rx="6" fill="#5C93C6" />
    <path
      d="M48 76c4-8 8 8 12 0s8 8 12 0"
      stroke="#fff"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
  </Wrap>
);

export const SpinachArt = (p: P) => (
  <Wrap {...p}>
    {[
      [-30, 0],
      [0, -6],
      [30, 0],
    ].map(([r], i) => (
      <g key={i} transform={`translate(60 100) rotate(${r})`}>
        <path d="M0 0c-26-12-28-48 0-72 28 24 26 60 0 72z" fill={i === 1 ? '#4F7A3F' : '#5E8F46'} />
        <path d="M0 0V-62" stroke="#3D6430" strokeWidth="2.5" />
      </g>
    ))}
  </Wrap>
);

export const ChickenArt = (p: P) => (
  <Wrap {...p}>
    <path
      d="M24 70c-6-26 14-42 42-40 24 2 34 18 28 36-6 18-30 26-52 20-10-3-16-8-18-16z"
      fill="#F3B7A4"
    />
    <path
      d="M30 66c4-18 20-28 40-24"
      stroke="#F9D2C6"
      strokeWidth="5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M44 84c14 6 32 2 42-10"
      stroke="#E39A86"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </Wrap>
);

export const YogurtArt = (p: P) => (
  <Wrap {...p}>
    <path
      d="M30 40h60l-6 56a8 8 0 0 1-8 7H44a8 8 0 0 1-8-7z"
      fill="#FFFDF8"
      stroke="#CFC8B8"
      strokeWidth="3"
    />
    <rect x="26" y="30" width="68" height="12" rx="5" fill="#9DB7D1" />
    <path d="M36 62h48l-2 24a6 6 0 0 1-6 5H44a6 6 0 0 1-6-5z" fill="#E7A9B8" />
    <circle cx="60" cy="76" r="9" fill="#fff" opacity=".6" />
  </Wrap>
);

export const TomatoIcon = (p: P) => (
  <Wrap {...p}>
    <ellipse cx="60" cy="68" rx="40" ry="36" fill="#D4432A" />
    <ellipse cx="46" cy="54" rx="12" ry="8" fill="#fff" opacity=".22" />
    <path d="M60 34l-14-9 11 2-4-11 11 8 6-10 4 11 11-4-8 11 13 4-17 4z" fill="#5E7355" />
  </Wrap>
);

export type ArtKey =
  | 'pasta'
  | 'frittata'
  | 'curry'
  | 'pancakes'
  | 'bowl'
  | 'salad'
  | 'soup'
  | 'tomato'
  | 'milk'
  | 'spinach'
  | 'chicken'
  | 'yogurt';

const MAP: Record<ArtKey, (p: P) => React.ReactElement> = {
  pasta: PastaArt,
  frittata: FrittataArt,
  curry: CurryArt,
  pancakes: PancakesArt,
  bowl: BowlArt,
  salad: SaladArt,
  soup: SoupArt,
  tomato: TomatoIcon,
  milk: MilkArt,
  spinach: SpinachArt,
  chicken: ChickenArt,
  yogurt: YogurtArt,
};

export function Art({ name, ...rest }: P & { name: ArtKey }) {
  const C = MAP[name];
  return <C {...rest} />;
}
