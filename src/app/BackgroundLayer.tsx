import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo } from 'react';
import { db } from '@/data/db';
import { BotanicalCorner } from '@/design/illustrations';
import { usePrefs } from './PrefsProvider';

function useBackgroundUrl(id: string | undefined) {
  const asset = useLiveQuery(() => (id ? db.mediaAssets.get(id) : undefined), [id]);
  const url = useMemo(() => (asset?.blob ? URL.createObjectURL(asset.blob) : undefined), [asset]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return url;
}

/** Fixed, non-interactive layer behind the app. Text always sits on opaque-ish cards. */
export function BackgroundLayer() {
  const { prefs } = usePrefs();
  const customUrl = useBackgroundUrl(
    prefs.background === 'custom' ? prefs.customBackgroundId : undefined,
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      {prefs.background === 'pattern' && <div className="pp-pattern absolute inset-0" />}
      {prefs.background === 'botanical' && (
        <>
          <BotanicalCorner className="absolute -right-10 -top-10 w-72 opacity-70 sm:w-96" />
          <BotanicalCorner className="absolute -bottom-12 -left-16 w-64 rotate-180 opacity-60 sm:w-80" />
        </>
      )}
      {prefs.background === 'custom' && customUrl && (
        <>
          <img
            src={customUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
            style={{
              filter: `blur(${prefs.bgBlur}px) contrast(${prefs.bgContrast}%)`,
              transform: 'scale(1.05)',
            }}
          />
          <div className="absolute inset-0 bg-bg" style={{ opacity: prefs.bgDim / 100 + 0.15 }} />
        </>
      )}
    </div>
  );
}
