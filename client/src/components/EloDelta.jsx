/** "+16" in green, "−16" in red, "±0" grey; "—" for unranked (null). */
export default function EloDelta({ delta, className = '' }) {
  if (delta === null || delta === undefined)
    return <span className={`text-zinc-500 ${className}`}>—</span>;
  const tone = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-400';
  return (
    <span className={`font-mono font-semibold ${tone} ${className}`}>
      {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
      {Math.abs(delta)}
    </span>
  );
}
