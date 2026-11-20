const TONES = {
  default: 'border-line-strong bg-surface text-ink',
  warning: 'border-amber-400/40 bg-zinc-900 text-amber-100',
  danger: 'border-red-500/40 bg-zinc-900 text-red-100',
  success: 'border-emerald-500/40 bg-zinc-900 text-emerald-100',
  info: 'border-sky-500/40 bg-zinc-900 text-sky-100',
};
const DOTS = {
  default: 'bg-zinc-400',
  warning: 'bg-amber-300',
  danger: 'bg-red-400',
  success: 'bg-emerald-400',
  info: 'bg-sky-400',
};

/** Stack of toasts (see hooks/useToasts.js), announced politely to screen readers. */
export function ToastStack({ toasts }) {
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 left-4 z-40 flex flex-col items-end gap-2 sm:left-auto"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/40 motion-safe:animate-fade-up ${TONES[t.tone] ?? TONES.default}`}
        >
          <span
            className={`size-2 shrink-0 rounded-full ${DOTS[t.tone] ?? DOTS.default}`}
            aria-hidden="true"
          />
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default ToastStack;
