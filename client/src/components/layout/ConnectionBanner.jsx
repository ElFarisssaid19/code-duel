import { useAuthStore } from '@/store/authStore.js';
import { useConnectionStore } from '@/store/connectionStore.js';

/** "Reconnecting…" while the real-time connection is down (only after it worked once). */
export default function ConnectionBanner() {
  const authStatus = useAuthStore((s) => s.status);
  const { socketStatus, everConnected } = useConnectionStore();
  if (authStatus !== 'authenticated' || !everConnected || socketStatus === 'connected') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="reconnecting-banner"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-amber-400/30 bg-amber-950/90 px-4 py-2 text-sm text-amber-100 backdrop-blur"
    >
      <span className="size-2 animate-pulse rounded-full bg-amber-300" aria-hidden="true" />
      Connection lost. Reconnecting…
    </div>
  );
}
