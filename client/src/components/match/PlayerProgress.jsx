/** Username, ELO, progress bar and attempts for one player. */
export default function PlayerProgress({
  player,
  label,
  align = 'left',
  typing = false,
  accent = 'emerald',
}) {
  const percent = player.total ? Math.round((player.passed / player.total) * 100) : 0;
  const bar = accent === 'emerald' ? 'bg-emerald-500' : 'bg-sky-500';
  const right = align === 'right';
  return (
    <div className={`min-w-0 flex-1 space-y-1.5 ${right ? 'text-right' : ''}`}>
      <div className={`flex items-baseline gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="truncate font-semibold text-zinc-100">{player.username}</span>
        <span className="font-mono text-xs text-zinc-500">{player.elo}</span>
        {label && <span className="text-xs text-zinc-500">{label}</span>}
        {player.connected === false && (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[0.7rem] font-medium text-red-300">
            offline
          </span>
        )}
      </div>
      <div className={`h-2 overflow-hidden rounded-full bg-zinc-800 ${right ? 'rotate-180' : ''}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div
        className={`flex items-center gap-3 text-xs text-zinc-400 ${right ? 'flex-row-reverse' : ''}`}
      >
        <span className="font-mono">
          {player.passed}/{player.total} tests
        </span>
        <span>
          {player.attempts} attempt{player.attempts === 1 ? '' : 's'}
        </span>
        {typing && <span className="animate-pulse text-sky-300">typing…</span>}
      </div>
    </div>
  );
}
