const STYLES = {
  ok: { dot: 'bg-emerald-500 shadow-emerald-500/60', text: 'text-emerald-400' },
  error: { dot: 'bg-red-500 shadow-red-500/60', text: 'text-red-400' },
  pending: { dot: 'bg-amber-400 shadow-amber-400/60 animate-pulse', text: 'text-amber-300' },
};

/** One service row with a green / red (or amber while checking) indicator. */
export default function StatusCard({ label, state, detail }) {
  const style = STYLES[state] ?? STYLES.pending;

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className={`size-3 rounded-full shadow-[0_0_10px] ${style.dot}`} aria-hidden="true" />
        <span className="font-medium text-zinc-100">{label}</span>
      </div>
      <span className={`font-mono text-sm ${style.text}`}>{detail}</span>
    </div>
  );
}
