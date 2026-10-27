import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/design/ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Install availability: the browser only fires this when the app is installable. */
export function useInstall() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  );
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return {
    installed,
    canInstall: !!evt && !installed,
    install: async () => {
      if (!evt) return;
      await evt.prompt();
      await evt.userChoice;
      setEvt(null);
    },
  };
}

export function StatusBanner() {
  const online = useOnline();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady && online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card lg:bottom-6"
    >
      {needRefresh ? (
        <>
          <RefreshCw aria-hidden className="size-5 shrink-0 text-accent-text" />
          <p className="flex-1 text-sm">A new version is ready.</p>
          <Button className="min-h-11" onClick={() => updateServiceWorker(true)}>
            Update
          </Button>
          <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
        </>
      ) : offlineReady ? (
        <>
          <Download aria-hidden className="size-5 shrink-0 text-good" />
          <p className="flex-1 text-sm">Ready to work offline.</p>
          <Button variant="ghost" onClick={() => setOfflineReady(false)}>
            OK
          </Button>
        </>
      ) : (
        <>
          <WifiOff aria-hidden className="size-5 shrink-0 text-warn" />
          <p className="flex-1 text-sm">
            You&apos;re offline. Everything saved on this device still works.
          </p>
        </>
      )}
    </div>
  );
}
