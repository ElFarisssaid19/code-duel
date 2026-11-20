const STYLES = {
  W: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  L: 'bg-red-500/15 text-red-400 ring-red-500/30',
  D: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
};
const LABELS = { W: 'Win', L: 'Loss', D: 'Draw' };

/** W / L / D square. */
export default function ResultBadge({ result }) {
  return (
    <span
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold ring-1 ring-inset ${STYLES[result] ?? STYLES.D}`}
      title={LABELS[result]}
    >
      {result ?? '–'}
    </span>
  );
}
