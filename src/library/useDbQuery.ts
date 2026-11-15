import { useEffect, useState } from 'react';

import { useLibrary } from './store';

/**
 * Runs an async database query and re-runs it when its inputs change or the
 * database changes. Keeps showing the last result while a new one loads, so
 * lists don't flash empty.
 */
export function useDbQuery<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const version = useLibrary((s) => s.version);
  const [data, setData] = useState<T>();

  useEffect(() => {
    let alive = true;
    query()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((e) => console.warn('Query failed', e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  return data;
}
