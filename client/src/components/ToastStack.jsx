const TONES = {
  default: 'border-zinc-700 bg-zinc-900 text-zinc-100',
  warning: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  danger: 'border-red-500/40 bg-red-500/10 text-red-100',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
};

export default function ToastStack({ toasts }) {
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/40 ${TONES[t.tone]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
