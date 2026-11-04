import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Button } from '@/design/ui';

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; run: () => void | Promise<void> };
  tone?: 'default' | 'error';
}
interface Ctx {
  toast: (t: Omit<ToastItem, 'id'>) => void;
}
const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      // Actions (Undo) stay a bit longer so they are reachable.
      setTimeout(() => dismiss(id), t.action ? 9000 : 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-[max(1rem,env(safe-area-inset-top))] z-[70] mx-auto grid max-w-md gap-2"
      >
        <AnimatePresence>
          {items.map((t) => (
            <m.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className={`pointer-events-auto flex items-center gap-3 rounded-2xl border p-3 shadow-card ${t.tone === 'error' ? 'border-bad bg-bad-soft text-bad' : 'border-line bg-surface'}`}
            >
              <p className="flex-1 text-sm font-medium">{t.message}</p>
              {t.action && (
                <Button
                  variant="soft"
                  onClick={async () => {
                    dismiss(t.id);
                    await t.action!.run();
                  }}
                >
                  {t.action.label}
                </Button>
              )}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx['toast'] {
  const v = useContext(ToastCtx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v.toast;
}
