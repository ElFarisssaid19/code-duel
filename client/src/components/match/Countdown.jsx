/** Lobby (waiting for both players) and the 3-2-1 countdown. */
export default function Countdown({ state, now, offsetMs }) {
  const { me, opponent, status, startsAt } = state;
  const seconds = status === 'COUNTDOWN' ? Math.ceil((startsAt - (now + offsetMs)) / 1000) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-4 text-center">
      <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
        {state.mode === 'RANKED' ? 'Ranked duel' : 'Private duel'}
      </p>
      <div className="flex items-center gap-6 sm:gap-10">
        <PlayerTag player={me} label="You" />
        <span className="text-2xl font-bold text-zinc-600">vs</span>
        <PlayerTag player={opponent} />
      </div>
      {status === 'COUNTDOWN' ? (
        <div
          className="font-mono text-8xl font-bold text-emerald-400 tabular-nums"
          aria-live="assertive"
        >
          {seconds > 0 ? seconds : 'Go!'}
        </div>
      ) : (
        <p className="animate-pulse text-zinc-400">Waiting for both players to connect…</p>
      )}
    </main>
  );
}

function PlayerTag({ player, label }) {
  return (
    <div className="space-y-1">
      <p className="text-xl font-bold text-zinc-100">{player.username}</p>
      <p className="font-mono text-sm text-zinc-500">
        {player.elo} ELO{label ? ` · ${label}` : ''}
      </p>
    </div>
  );
}
