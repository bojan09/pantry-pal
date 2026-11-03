import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { usePrefs } from '@/app/PrefsProvider';

/**
 * A short "well done" moment after a cook is saved: a check mark and rising steam. It never
 * covers controls that matter (the cook is already finished) and is skipped entirely for
 * the Low motion setting or when the device asks for reduced motion.
 */
export function useFlourishDelay(): number {
  const { prefs } = usePrefs();
  const reduced = useReducedMotion();
  return prefs.motion === 'low' || reduced ? 0 : prefs.motion === 'cinematic' ? 2000 : 1300;
}

export function CookedFlourish({
  name,
  onDone,
  ms,
}: {
  name: string;
  onDone: () => void;
  ms: number;
}) {
  const { prefs } = usePrefs();
  // Keep the latest callback without restarting the timer on every parent render.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const t = setTimeout(() => done.current(), ms);
    return () => clearTimeout(t);
  }, [ms]);
  const rich = prefs.motion === 'cinematic';
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] grid place-items-center bg-charcoal/70 p-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.85, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="relative grid w-[min(90vw,24rem)] justify-items-center gap-3 rounded-3xl bg-surface p-8 text-center shadow-card"
      >
        <svg viewBox="0 0 120 60" aria-hidden className="absolute -top-10 h-16 w-28">
          {[28, 60, 92].map((x, i) => (
            <motion.path
              key={x}
              d={`M${x} 56c-8-8 8-14 0-24s8-14 0-22`}
              fill="none"
              stroke="var(--color-oat)"
              strokeWidth="5"
              strokeLinecap="round"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 0.9, 0], y: [10, -6, -14] }}
              transition={{ duration: 1.6, repeat: rich ? Infinity : 0, delay: i * 0.25 }}
            />
          ))}
        </svg>
        <span className="grid size-16 place-items-center rounded-full bg-good text-white">
          <Check aria-hidden className="size-9" strokeWidth={3} />
        </span>
        <p className="font-display text-3xl font-semibold">Enjoy your meal</p>
        <p className="text-ink-soft">{name} is in your cooking history.</p>
        {rich &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute size-2 rounded-full bg-saffron"
              style={{ left: `${15 + i * 14}%`, top: '45%' }}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], y: -60 - (i % 3) * 18, scale: 1 }}
              transition={{ duration: 1.3, delay: 0.1 + i * 0.08 }}
            />
          ))}
      </motion.div>
    </motion.div>
  );
}
