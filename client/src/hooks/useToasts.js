import { useCallback, useEffect, useRef, useState } from 'react';

/** Small auto-dismissing toast queue. */
export function useToasts(durationMs = 3500) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef([]);
  const push = useCallback(
    (message, tone = 'default') => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      timers.current.push(
        setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), durationMs),
      );
    },
    [durationMs],
  );
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return [toasts, push];
}
