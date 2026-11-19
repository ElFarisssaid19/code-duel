/** A labelled monospace box for inputs, outputs, errors and logs. */
export default function ValueBlock({ label, children, tone = 'default' }) {
  const toneClass = {
    default: 'text-zinc-200',
    danger: 'text-red-300 border-red-500/30 bg-red-500/5',
    muted: 'text-zinc-400',
  }[tone];

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</p>
      <pre
        className={`max-h-48 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-[0.8rem] leading-relaxed break-all whitespace-pre-wrap ${toneClass}`}
      >
        {children}
      </pre>
    </div>
  );
}
