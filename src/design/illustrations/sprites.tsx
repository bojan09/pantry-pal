import type { SVGProps } from 'react';
import type { SpriteKind } from '@/data/catalog';

const PALETTE = [
  '#D4432A',
  '#E8B95D',
  '#74866B',
  '#C9733A',
  '#5C93C6',
  '#8A5A32',
  '#B03A55',
  '#9DB38F',
];

const NAMED: [RegExp, string][] = [
  [/tomato/i, '#D4432A'],
  [
    /spinach|lettuce|basil|parsley|broccoli|zucchini|cucumber|cabbage|peas|thyme|oregano/i,
    '#5E8F46',
  ],
  [/carrot|orange|pumpkin|paprika/i, '#E07B24'],
  [/banana|lemon|corn|butter|honey|cheese/i, '#E8C03F'],
  [/onion|garlic|egg|milk|yogurt|cream|rice|flour|sugar|salt|oats|couscous/i, '#EFE3C8'],
  [/strawberr|berries|beet|bean|chili/i, '#B03A55'],
  [/apple/i, '#C0392B'],
  [/eggplant|grape|plum/i, '#6E4A7E'],
  [/chicken|pork|bacon|sausage/i, '#F3B7A4'],
  [/salmon|tuna|fish/i, '#F0A08A'],
  [/beef/i, '#A3432F'],
];

/** Deterministic colour: a known food keeps its natural colour, others hash into the palette. */
export function colorFor(name: string, id: string): string {
  for (const [re, c] of NAMED) if (re.test(name)) return c;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const label = '#F6EBD2';

const Letter = ({ ch, y, size = 8 }: { ch?: string; y: number; size?: number }) =>
  ch ? (
    <text
      x="15"
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontWeight="700"
      fontFamily="Georgia, serif"
      fill="#5A3A1A"
    >
      {ch}
    </text>
  ) : null;

/** `name` adds the ingredient's initial to the label so identical packages stay distinguishable. */
export function ItemSprite({
  kind,
  color,
  name,
  ...rest
}: SVGProps<SVGSVGElement> & { kind: SpriteKind; color: string; name?: string }) {
  const ch = name?.trim().charAt(0).toUpperCase();
  return (
    <svg viewBox="0 0 30 40" aria-hidden="true" {...rest}>
      <ellipse cx="15" cy="38.5" rx="11" ry="1.6" fill="#000" opacity=".12" />
      {kind === 'produce' && (
        <>
          <ellipse cx="15" cy="24" rx="12" ry="12.5" fill={color} />
          <ellipse cx="10.5" cy="19" rx="3.6" ry="2.6" fill="#fff" opacity=".28" />
          <path
            d="M15 12l-4-3 3.2.6-1-3.4 3.2 2.6 1.8-3 1.2 3.4 3.4-1-2 3.4 3.8 1.2-5.2 1.2z"
            fill="#5E7355"
            transform="translate(0 4) scale(.8) translate(3.5 0)"
          />
        </>
      )}
      {kind === 'carton' && (
        <>
          <path
            d="M7 14h16l3 6v17H4V20z"
            fill="#F7F4EC"
            stroke="#CFC8B8"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path d="M7 14h16l-3 6H10z" fill="#DDE6EC" />
          <rect
            x="7"
            y="25"
            width="16"
            height="8"
            rx="2"
            fill={color === '#EFE3C8' ? '#5C93C6' : color}
          />
        </>
      )}
      {kind === 'tray' && (
        <>
          <rect
            x="3"
            y="24"
            width="24"
            height="13"
            rx="3"
            fill="#F7F4EC"
            stroke="#CFC8B8"
            strokeWidth="1.2"
          />
          <path d="M6 30c1-6 8-8 14-6 4 1 5 6 2 8-4 3-14 3-16-2z" fill={color} />
        </>
      )}
      {kind === 'jar' && (
        <>
          <rect x="7" y="4" width="16" height="5" rx="2" fill="#B07A45" />
          <rect
            x="4"
            y="9"
            width="22"
            height="28"
            rx="5"
            fill="#FFFDF8"
            stroke="#D9C7A6"
            strokeWidth="1.2"
          />
          <rect x="6" y="20" width="18" height="15" rx="3" fill={color} opacity=".9" />
          <rect x="8" y="14" width="14" height="6" rx="1.5" fill={label} />
          <Letter ch={ch} y={19.2} size={6.4} />
        </>
      )}
      {kind === 'spice' && (
        <>
          <rect x="9" y="8" width="12" height="5" rx="2" fill="#6B8A4D" />
          <rect
            x="7"
            y="13"
            width="16"
            height="24"
            rx="3.5"
            fill="#FFFDF8"
            stroke="#D9C7A6"
            strokeWidth="1.2"
          />
          <rect x="8.5" y="22" width="13" height="13" rx="2" fill={color} opacity=".9" />
          <rect x="9" y="16" width="12" height="5" rx="1.2" fill={label} />
          <Letter ch={ch} y={20.2} size={5.4} />
        </>
      )}
      {kind === 'can' && (
        <>
          <rect x="5" y="9" width="20" height="28" rx="3" fill="#C9CFD2" />
          <rect
            x="5"
            y="14"
            width="20"
            height="18"
            fill={color === '#EFE3C8' ? '#D4432A' : color}
          />
          <rect x="8" y="19" width="14" height="8" rx="1.5" fill={label} />
          <Letter ch={ch} y={25.4} size={7} />
          <ellipse cx="15" cy="9" rx="10" ry="2.2" fill="#E3E7E9" />
        </>
      )}
      {kind === 'bottle' && (
        <>
          <rect x="12" y="2" width="6" height="5" rx="1.5" fill="#6B8A4D" />
          <path
            d="M12 7h6v5c4 2 7 5 7 9v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V21c0-4 3-7 7-9z"
            fill={color === '#EFE3C8' ? '#E8C03F' : color}
            opacity=".92"
          />
          <rect x="8" y="22" width="14" height="9" rx="1.5" fill={label} />
          <Letter ch={ch} y={29} size={7.4} />
        </>
      )}
      {kind === 'box' && (
        <>
          <rect
            x="4"
            y="12"
            width="22"
            height="25"
            rx="3"
            fill="#DCE8EE"
            stroke="#BCD0DA"
            strokeWidth="1.2"
          />
          <rect
            x="7"
            y="17"
            width="16"
            height="10"
            rx="2"
            fill={color === '#EFE3C8' ? '#9DB7D1' : color}
            opacity=".9"
          />
          <path d="M9 31l2 2m0-2l-2 2M19 31l2 2m0-2l-2 2" stroke="#8FB0C2" strokeWidth="1" />
        </>
      )}
      {kind === 'loaf' && (
        <>
          <path d="M3 28c0-9 5-14 12-14s12 5 12 14v8H3z" fill="#D9A25B" />
          <path
            d="M9 21l3 5M15 20l3 6M21 21l3 5"
            stroke="#B87A35"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'bag' && (
        <>
          <path
            d="M5 11l3-3h14l3 3v25a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"
            fill={color === '#EFE3C8' ? '#F1E4CE' : color}
            stroke="#00000022"
            strokeWidth="1"
          />
          <path d="M6 12h18" stroke="#00000033" strokeWidth="2" strokeDasharray="1.5 1.5" />
          <rect x="8" y="19" width="14" height="10" rx="2" fill={label} />
          <Letter ch={ch} y={27} size={8} />
        </>
      )}
    </svg>
  );
}
