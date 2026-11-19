import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api.js';

/** Polls GET /api/health. */
export function useHealth(intervalMs = 5000) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const check = useCallback(async () => {
    try {
      const data = await api.get('/health');
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, []);

  useEffect(() => {
    // Defer the first check so state updates never run synchronously inside the effect.
    const first = setTimeout(check, 0);
    const id = setInterval(check, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [check, intervalMs]);

  return { ...state, refresh: check };
}
