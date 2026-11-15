import type { Asset } from 'expo-media-library/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLibrary } from '../library/store';
import { fetchPage } from './query';

/**
 * Paged list of the whole library for the Library grid. Loads 60 at a time
 * so huge libraries stay fast. Reloads after a delete.
 */
export function usePhotos() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const cursor = useRef<string | undefined>(undefined);
  const hasNext = useRef(true);
  const loading = useRef(false);
  const generation = useRef(0); // ignores results from before a reload
  const libraryVersion = useLibrary((s) => s.libraryVersion);

  const load = useCallback(async (reset: boolean) => {
    if (!reset && (loading.current || !hasNext.current)) return;
    loading.current = true;
    const gen = generation.current;
    try {
      const page = await fetchPage(reset ? undefined : cursor.current);
      if (gen !== generation.current) return;
      cursor.current = page.endCursor;
      hasNext.current = page.hasNextPage;
      setAssets((prev) => (reset ? page.assets : [...prev, ...page.assets]));
    } catch (e) {
      console.warn('Loading photos failed', e);
    } finally {
      if (gen === generation.current) loading.current = false;
    }
  }, []);

  const loadMore = useCallback(() => load(false), [load]);

  // First page, and a fresh start after a delete (replaces the list when it arrives).
  useEffect(() => {
    generation.current += 1;
    void load(true);
  }, [libraryVersion, load]);

  return { assets, loadMore };
}
