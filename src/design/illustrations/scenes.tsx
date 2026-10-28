import { Art, type ArtKey } from './food';

export type Zone = 'pantry' | 'fridge' | 'freezer';

function JarShape({
  x,
  y,
  w = 26,
  h = 38,
  fill,
  lid = '#B07A45',
  label = '#F1E4CE',
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  fill: string;
  lid?: string;
  label?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={w * 0.14} y="0" width={w * 0.72} height="6" rx="2" fill={lid} />
      <rect
        x="0"
        y="6"
        width={w}
        height={h - 6}
        rx="5"
        fill="#FFFDF8"
        opacity=".92"
        stroke="#D9C7A6"
        strokeWidth="1.5"
      />
      <rect x="2" y={h * 0.42} width={w - 4} height={h * 0.5} rx="3" fill={fill} opacity=".9" />
      <rect x={w * 0.2} y={h * 0.3} width={w * 0.6} height={h * 0.2} rx="1.5" fill={label} />
    </g>
  );
}

const PANTRY_JARS: [number, number, string][][] = [
  [
    [30, 0, '#E8B95D'],
    [62, 0, '#C9733A'],
    [94, 0, '#F4EBD8'],
    [126, 0, '#8A5A32'],
    [158, 0, '#B03A2E'],
    [196, 0, '#E8B95D'],
  ],
  [
    [34, 0, '#F4EBD8'],
    [68, 0, '#D4432A'],
    [102, 0, '#74866B'],
    [136, 0, '#E0A941'],
    [170, 0, '#C9733A'],
  ],
];

/**
 * Illustrated storage scene. With `filled` false (the real app's default) it draws
 * empty shelves only, so it never implies stock the user has not logged.
 */
export function StorageScene({
  zone,
  filled = false,
  className,
}: {
  zone: Zone;
  filled?: boolean;
  className?: string;
}) {
  const frame = zone === 'pantry' ? '#8A5A32' : '#D5DEDB';
  const inside = zone === 'pantry' ? '#EFE0C6' : zone === 'fridge' ? '#F2F6F4' : '#E3EEF3';
  const shelf = zone === 'pantry' ? '#A9733F' : '#BCC8C4';
  const shelfYs = [84, 144];
  return (
    <svg
      viewBox="0 0 400 230"
      className={className}
      role="img"
      aria-label={filled ? `Illustrated sample ${zone}` : `Empty ${zone} shelves`}
    >
      <rect x="4" y="4" width="392" height="222" rx="18" fill={frame} />
      <rect x="18" y="18" width="364" height="194" rx="10" fill={inside} />
      {zone === 'pantry' && (
        <g opacity=".18" stroke="#8A5A32" strokeWidth="2">
          {[70, 140, 210, 280, 350].map((x) => (
            <path key={x} d={`M${x} 18V212`} />
          ))}
        </g>
      )}
      {shelfYs.map((y) => (
        <rect key={y} x="18" y={y} width="364" height="10" fill={shelf} />
      ))}
      <rect x="18" y="202" width="364" height="10" fill={shelf} />
      {zone === 'freezer' && (
        <g stroke="#9DB7C4" strokeWidth="2" strokeLinecap="round" opacity=".7">
          <path d="M60 40l10 10M70 40l-10 10M330 100l10 10M340 100l-10 10M200 160l8 8M208 160l-8 8" />
        </g>
      )}
      {filled && zone === 'pantry' && (
        <>
          {PANTRY_JARS[0].map(([x, , c], i) => (
            <JarShape key={i} x={x} y={44} fill={c} h={40} />
          ))}
          {PANTRY_JARS[1].map(([x, , c], i) => (
            <JarShape key={i} x={x} y={104} fill={c} h={40} lid={i % 2 ? '#74866B' : '#B07A45'} />
          ))}
          <g transform="translate(250 100)">
            <rect width="46" height="44" rx="5" fill="#D9B77C" />
            <rect x="6" y="12" width="34" height="14" rx="2" fill="#F4EBD8" />
          </g>
          <g transform="translate(306 106)">
            <rect width="38" height="38" rx="5" fill="#C9733A" />
            <rect x="5" y="12" width="28" height="12" rx="2" fill="#F4EBD8" />
          </g>
          <circle cx="60" cy="184" r="14" fill="#D4432A" />
          <circle cx="86" cy="186" r="13" fill="#E0A941" />
          <circle cx="112" cy="185" r="14" fill="#74866B" />
          <g transform="translate(150 160)">
            <rect width="30" height="42" rx="4" fill="#E8D5A8" />
            <rect x="4" y="12" width="22" height="14" rx="2" fill="#B07A45" />
          </g>
          <g transform="translate(190 164)">
            <rect width="30" height="38" rx="4" fill="#F4EBD8" />
            <rect x="4" y="10" width="22" height="12" rx="2" fill="#D4432A" />
          </g>
          <rect x="236" y="168" width="52" height="34" rx="6" fill="#B07A45" />
          <path d="M244 168c0-16 36-16 36 0" stroke="#8A5A32" strokeWidth="4" fill="none" />
          <circle cx="262" cy="162" r="9" fill="#D4432A" />
          <circle cx="276" cy="164" r="8" fill="#E0A941" />
          <rect x="310" y="150" width="14" height="52" rx="3" fill="#3C5A2F" />
          <rect x="326" y="158" width="14" height="44" rx="3" fill="#8A3A2A" />
          <rect x="342" y="154" width="14" height="48" rx="3" fill="#6B8A4D" />
        </>
      )}
      {filled && zone === 'fridge' && (
        <>
          <g transform="translate(34 40)">
            <rect width="34" height="44" rx="4" fill="#F7F4EC" stroke="#CFC8B8" strokeWidth="2" />
            <rect x="5" y="16" width="24" height="16" rx="3" fill="#5C93C6" />
          </g>
          <g transform="translate(78 52)">
            <rect width="30" height="32" rx="4" fill="#FFFDF8" stroke="#CFC8B8" strokeWidth="2" />
            <rect x="3" y="3" width="24" height="8" rx="3" fill="#9DB7D1" />
          </g>
          {[
            [130, 70],
            [156, 72],
            [143, 58],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="13" fill="#D4432A" />
          ))}
          <g transform="translate(200 46)">
            {[0, 24, 48].map((dx) => (
              <ellipse
                key={dx}
                cx={dx + 14}
                cy="30"
                rx="11"
                ry="14"
                fill="#F5EEDC"
                stroke="#E0D2B4"
                strokeWidth="1.5"
              />
            ))}
          </g>
          <g transform="translate(290 44)">
            <path d="M4 40c-8-24 8-40 26-40 12 22 6 42-26 40z" fill="#5E8F46" />
            <path d="M30 40c-6-22 8-38 28-38 4 20-2 36-28 38z" fill="#4F7A3F" />
          </g>
          {[
            [50, 124],
            [86, 124],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect width="30" height="20" rx="4" fill="#F3B7A4" />
              <rect x="3" y="3" width="24" height="5" rx="2" fill="#F9D2C6" />
            </g>
          ))}
          <g transform="translate(150 106)">
            <rect width="52" height="38" rx="4" fill="#E8D8A8" stroke="#C7B27A" strokeWidth="2" />
            <rect x="6" y="8" width="40" height="10" rx="2" fill="#F7E7A6" />
          </g>
          <g transform="translate(230 112)">
            <rect width="38" height="32" rx="5" fill="#FFFDF8" stroke="#CFC8B8" strokeWidth="2" />
            <rect x="4" y="9" width="30" height="10" rx="2" fill="#E7A9B8" />
          </g>
          <g transform="translate(290 164)">
            {[0, 26, 52].map((dx, i) => (
              <ellipse
                key={dx}
                cx={dx + 12}
                cy="30"
                rx="12"
                ry="10"
                fill={['#D4432A', '#E0A941', '#74866B'][i]}
              />
            ))}
          </g>
          <g transform="translate(40 168)">
            <path d="M4 30c-6-24 10-36 24-34 10 18 4 36-24 34z" fill="#8FA283" />
            <path d="M32 30c-4-20 8-32 22-32 4 18-2 30-22 32z" fill="#5E8F46" />
          </g>
          <g transform="translate(120 170)">
            <rect width="46" height="30" rx="5" fill="#F7F4EC" stroke="#CFC8B8" strokeWidth="2" />
            <rect x="5" y="8" width="36" height="9" rx="2" fill="#5C93C6" opacity=".7" />
          </g>
        </>
      )}
      {filled && zone === 'freezer' && (
        <>
          {[
            [34, 54, '#9DB7D1'],
            [82, 54, '#E7A9B8'],
            [130, 54, '#C9E0B5'],
            [178, 54, '#F3D9A4'],
          ].map(([x, y, c], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect width="40" height="30" rx="5" fill={c as string} />
              <rect x="5" y="9" width="30" height="9" rx="2" fill="#fff" opacity=".75" />
            </g>
          ))}
          {[
            [230, 40],
            [262, 40],
            [294, 40],
          ].map(([x, y], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width="26"
              height="44"
              rx="5"
              fill={['#E8B95D', '#9DB7D1', '#D4432A'][i]}
              opacity=".85"
            />
          ))}
          {[
            [40, 110],
            [96, 110],
            [152, 110],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect width="48" height="32" rx="5" fill="#F7F4EC" stroke="#BCD0DA" strokeWidth="2" />
              <circle cx="14" cy="16" r="7" fill={['#D4432A', '#5E8F46', '#E0A941'][i]} />
            </g>
          ))}
          <g transform="translate(240 106)">
            {[0, 30, 60].map((dx, i) => (
              <rect
                key={dx}
                x={dx}
                y="0"
                width="26"
                height="34"
                rx="4"
                fill={['#F3B7A4', '#C9E0B5', '#F3D9A4'][i]}
              />
            ))}
          </g>
          <g transform="translate(40 166)">
            <rect width="120" height="30" rx="6" fill="#DCE8EE" />
            <rect x="8" y="8" width="104" height="9" rx="3" fill="#9DB7D1" opacity=".7" />
          </g>
          <g transform="translate(190 166)">
            <rect width="150" height="30" rx="6" fill="#F7F4EC" stroke="#BCD0DA" strokeWidth="2" />
          </g>
        </>
      )}
    </svg>
  );
}

/** Wide kitchen-window backdrop for the Home hero (decorative). */
export function KitchenBackdrop({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 340"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="kb-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B07A45" />
          <stop offset="1" stopColor="#8A5A32" />
        </linearGradient>
        <linearGradient id="kb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFE4EF" />
          <stop offset="1" stopColor="#F6EBCF" />
        </linearGradient>
      </defs>
      <rect width="1200" height="340" fill="url(#kb-wall)" />
      <g stroke="#7A4C28" strokeWidth="2" opacity=".35">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <path key={i} d={`M${i * 110} 0V340`} />
        ))}
      </g>
      <path d="M420 340V120a190 190 0 0 1 380 0v220z" fill="#6E4524" />
      <path d="M436 340V122a174 174 0 0 1 348 0v218z" fill="url(#kb-sky)" />
      <path d="M436 270c60-40 100-20 150-48s120-10 198 20v98H436z" fill="#9BB58B" />
      <path d="M436 300c80-30 140-10 200-30s110-10 148 6v64H436z" fill="#7E9A70" />
      <path d="M610 -4V340M436 150H784" stroke="#6E4524" strokeWidth="6" />
      <rect x="380" y="322" width="440" height="18" fill="#5A3818" />
      {/* shelves with jars, left and right */}
      <rect x="40" y="150" width="300" height="9" fill="#5A3818" />
      <rect x="860" y="150" width="300" height="9" fill="#5A3818" />
      <rect x="40" y="250" width="300" height="9" fill="#5A3818" />
      <rect x="860" y="250" width="300" height="9" fill="#5A3818" />
      {[60, 100, 142, 184, 226, 270].map((x, i) => (
        <JarShape
          key={x}
          x={x}
          y={106}
          w={30}
          h={44}
          fill={['#E8B95D', '#C9733A', '#F4EBD8', '#D4432A', '#8A5A32', '#74866B'][i]}
        />
      ))}
      {[880, 922, 964, 1006, 1048, 1090].map((x, i) => (
        <JarShape
          key={x}
          x={x}
          y={106}
          w={30}
          h={44}
          fill={['#F4EBD8', '#E8B95D', '#74866B', '#C9733A', '#D4432A', '#E8B95D'][i]}
        />
      ))}
      {[70, 120, 172, 224].map((x, i) => (
        <JarShape
          key={x}
          x={x}
          y={206}
          w={34}
          h={44}
          fill={['#D4432A', '#E8B95D', '#F4EBD8', '#74866B'][i]}
          lid="#74866B"
        />
      ))}
      {[890, 950, 1010, 1070].map((x, i) => (
        <JarShape
          key={x}
          x={x}
          y={206}
          w={34}
          h={44}
          fill={['#F4EBD8', '#C9733A', '#74866B', '#E8B95D'][i]}
          lid="#74866B"
        />
      ))}
      {/* hanging plants */}
      {[
        [372, 0],
        [830, 0],
      ].map(([x], i) => (
        <g key={i} transform={`translate(${x} 0)`}>
          <path d="M0 0V60" stroke="#5A3818" strokeWidth="3" />
          <path d="M-10 60h20l-4 22h-12z" fill="#C9733A" />
          {[-26, -14, 0, 14, 26].map((dx, j) => (
            <path
              key={j}
              d={`M${dx / 2} 62c${dx} 10 ${dx * 1.2} 40 ${dx * 0.8} 78`}
              stroke="#5E8F46"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Tomato + herbs cluster for the sidebar footer. */
export function SidebarArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 200" className={className} aria-hidden="true">
      <path
        d="M150 200c-4-60 4-120 36-196"
        stroke="#5E7355"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {[
        [156, 160, -1],
        [160, 130, 1],
        [166, 100, -1],
        [174, 72, 1],
        [182, 44, -1],
      ].map(([x, y, s], i) => (
        <path
          key={i}
          d={`M${x} ${y}c${s * 28}-6 ${s * 36}-24 ${s * 34}-38-${s * 18} 2-${s * 34} 14-${s * 34} 38z`}
          fill={i % 2 ? '#74866B' : '#8FA283'}
        />
      ))}
      <ellipse cx="90" cy="168" rx="52" ry="30" fill="#C99A5B" opacity=".0" />
      <circle cx="90" cy="150" r="40" fill="#D4432A" />
      <ellipse cx="76" cy="134" rx="12" ry="8" fill="#fff" opacity=".25" />
      <path d="M90 112l-14-9 11 2-4-11 11 8 6-10 4 11 11-4-8 11 13 4-17 4z" fill="#5E7355" />
      <circle cx="40" cy="176" r="18" fill="#E8B95D" />
      <circle cx="22" cy="182" r="13" fill="#D4432A" />
      <ellipse cx="170" cy="186" rx="34" ry="12" fill="#EFE3C8" />
      <ellipse cx="170" cy="182" rx="28" ry="8" fill="#74866B" />
    </svg>
  );
}

export function FoodThumb({ name, className }: { name: ArtKey; className?: string }) {
  return <Art name={name} className={className} />;
}
