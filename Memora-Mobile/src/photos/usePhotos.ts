import type { Asset } from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTrash } from '../trash/store';
import { fetchPage, type PhotoFilter } from './query';

/**
 * Paged list of photos for a filter. Loads 60 at a time so huge libraries
 * (50k+ photos) stay fast. Reloads when the filter changes or after a delete.
 */
export function usePhotos(filter: PhotoFilter, enabled = true) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNext, setHasNext] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cursor = useRef<string | undefined>(undefined);
  const hasNextRef = useRef(true);
  const loading = useRef(false);
  const generation = useRef(0); // ignores results from an old filter
  const libraryVersion = useTrash((s) => s.libraryVersion);

  const key = `${filter.type}|${filter.year ?? 'any'}|${libraryVersion}`;

  const loadMore = useCallback(async () => {
    if (!enabled || loading.current || !hasNextRef.current) return;
    loading.current = true;
    setIsLoading(true);
    const gen = generation.current;
    try {
      const page = await fetchPage(filter, cursor.current);
      if (gen !== generation.current) return;
      cursor.current = page.endCursor;
      hasNextRef.current = page.hasNextPage;
      setHasNext(page.hasNextPage);
      setAssets((prev) => [...prev, ...page.assets]);
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (gen === generation.current) {
        loading.current = false;
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    generation.current += 1;
    cursor.current = undefined;
    hasNextRef.current = true;
    loading.current = false;
    setAssets([]);
    setHasNext(true);
    setError(null);
    if (enabled) loadMore();
  }, [key, enabled, loadMore]);

  return { assets, loadMore, isLoading, hasNext, error };
}
