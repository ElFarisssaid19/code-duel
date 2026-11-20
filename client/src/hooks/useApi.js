import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api.js';

/**
 * GET `path` with loading / error / retry. Re-fetches when `path` changes; `retry()` re-runs it.
 * `path = null` skips the request.
 */
export function useApi(path) {
  const [attempt, setAttempt] = useState(0);
  const key = path === null ? null : `${path}#${attempt}`;
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    api
      .get(path)
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch((error) => !cancelled && setState({ key, data: null, error }));
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: key !== null && !current,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
