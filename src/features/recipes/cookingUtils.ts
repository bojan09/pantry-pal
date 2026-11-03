import { useEffect, useState } from 'react';

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (t: 'release', cb: () => void) => void;
};
type NavWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

export type WakeState = 'unsupported' | 'on' | 'off';

/**
 * Asks the browser to keep the screen awake while cooking, where supported. The request is
 * dropped when the tab is hidden, so it is re-requested when the tab becomes visible again.
 */
export function useWakeLock(enabled: boolean): WakeState {
  const supported = typeof navigator !== 'undefined' && !!(navigator as NavWithWakeLock).wakeLock;
  const [state, setState] = useState<WakeState>(supported ? 'off' : 'unsupported');
  useEffect(() => {
    if (!enabled || !supported) return;
    let sentinel: WakeLockSentinelLike | undefined;
    let cancelled = false;
    const acquire = async () => {
      try {
        const s = await (navigator as NavWithWakeLock).wakeLock!.request('screen');
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel = s;
        setState('on');
        s.addEventListener('release', () => !cancelled && setState('off'));
      } catch {
        setState('off'); // denied (e.g. low battery); cooking still works
      }
    };
    const onVis = () => document.visibilityState === 'visible' && !sentinel && void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void sentinel?.release();
    };
  }, [enabled, supported]);
  return state;
}

let ctx: AudioContext | undefined;

/** Call from a click handler so the browser allows sound later when a timer finishes. */
export function primeAudio() {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* sound is optional */
  }
}

/** Three short beeps plus a vibration where available. Silent if audio was never primed. */
export function chime() {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 200]);
  } catch {
    /* ignore */
  }
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t0 + i * 0.35);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.35 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.35 + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + i * 0.35);
    o.stop(t0 + i * 0.35 + 0.3);
  }
}

/** Shows a system notification if the user already granted permission. Never asks. */
export function notifyTimerDone(label: string) {
  try {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      document.hidden
    ) {
      new Notification('Timer finished', { body: label });
    }
  } catch {
    /* ignore */
  }
}
