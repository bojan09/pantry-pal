import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';

/** Object URL for a stored image, revoked when it changes or the component unmounts. */
export function useMediaUrl(id: string | undefined): string | undefined {
  const asset = useLiveQuery(() => (id ? db.mediaAssets.get(id) : undefined), [id]);
  const url = useMemo(() => (asset?.blob ? URL.createObjectURL(asset.blob) : undefined), [asset]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return url;
}
