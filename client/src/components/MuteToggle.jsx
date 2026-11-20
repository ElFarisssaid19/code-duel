import { usePreferencesStore } from '@/store/preferencesStore.js';

/** Speaker icon button that mutes / unmutes game sounds (saved in localStorage). */
export default function MuteToggle({ className = '' }) {
  const soundEnabled = usePreferencesStore((s) => s.soundEnabled);
  const toggleSound = usePreferencesStore((s) => s.toggleSound);
  const label = soundEnabled ? 'Mute sounds' : 'Unmute sounds';
  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-label={label}
      aria-pressed={!soundEnabled}
      title={label}
      data-testid="mute-toggle"
      className={`inline-flex size-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-raised hover:text-ink active:bg-zinc-700/60 ${className}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
        <path d="M10 3.75a.75.75 0 0 0-1.264-.546L5.203 6.5H3.5A1.5 1.5 0 0 0 2 8v4a1.5 1.5 0 0 0 1.5 1.5h1.703l3.533 3.296A.75.75 0 0 0 10 16.25V3.75Z" />
        {soundEnabled ? (
          <path d="M13.53 6.47a.75.75 0 0 1 1.06 0 5 5 0 0 1 0 7.06.75.75 0 1 1-1.06-1.06 3.5 3.5 0 0 0 0-4.94.75.75 0 0 1 0-1.06Z" />
        ) : (
          <path d="M13.28 7.22a.75.75 0 1 0-1.06 1.06L13.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L15 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L16.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L15 8.94l-1.72-1.72Z" />
        )}
      </svg>
    </button>
  );
}
