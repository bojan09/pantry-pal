import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { MotionConfig } from 'motion/react';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from './prefs';

interface PrefsCtx {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
  reset: () => void;
}
const Ctx = createContext<PrefsCtx | null>(null);

const MOTION_SCALE = { low: 0, balanced: 1, cinematic: 1.4 } as const;

function useSystemDark() {
  const [dark, setDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const systemDark = useSystemDark();

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    savePrefs(DEFAULT_PREFS);
    setPrefs(DEFAULT_PREFS);
  }, []);

  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && systemDark);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.accent = prefs.accent;
    root.style.setProperty('--motion-scale', String(MOTION_SCALE[prefs.motion]));
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#1d1f1a' : '#D76543');
  }, [dark, prefs.accent, prefs.motion]);

  const value = useMemo(() => ({ prefs, update, reset }), [prefs, update, reset]);
  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion={prefs.motion === 'low' ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </Ctx.Provider>
  );
}

export function usePrefs(): PrefsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs outside PrefsProvider');
  return v;
}
