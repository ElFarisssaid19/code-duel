import { useEffect } from 'react';
import Logo from '@/components/Logo.jsx';
import GhostName from '@/components/match/GhostName.jsx';
import { playSound } from '@/lib/sound.js';

const playedTicks = new Set();

/** Lobby ("Match found!", waiting for both clients) and the big animated 3-2-1. */
export default function Countdown({ state, now, offsetMs }) {
  const { me, opponent, status, startsAt } = state;
  const seconds = status === 'COUNTDOWN' ? Math.ceil((startsAt - (now + offsetMs)) / 1000) : null;
  const shown = seconds === null ? null : Math.max(seconds, 0);
  // One tick per number (3, 2, 1), even across re-renders/remounts. "Go" plays on match:start.
  useEffect(() => {
    const key = `${startsAt}:${shown}`;
    if (shown === null || shown < 1 || shown > 3 || playedTicks.has(key)) return;
    playedTicks.add(key);
    playSound('tick');
  }, [shown, startsAt]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-10 overflow-hidden px-4 text-center">
      <div className="absolute top-4 left-4">
        <Logo className="text-sm" />
      </div>
      <p className="eyebrow motion-safe:animate-pop-in">
        {{ RANKED: 'Ranked duel', PRIVATE: 'Private duel', GHOST: 'Ghost duel' }[state.mode]} ·{' '}
        {state.mode === 'GHOST' ? 'Replay ready' : 'Match found'}
      </p>
      <div className="flex items-center gap-5 sm:gap-10">
        <PlayerTag player={me} label="You" side="me" />
        <span className="flex size-14 items-center justify-center rounded-full border border-line-strong bg-surface font-display text-xl font-bold text-ink motion-safe:animate-glow-pulse">
          VS
        </span>
        <PlayerTag player={opponent} side="rival" />
      </div>
      {status === 'COUNTDOWN' ? (
        <div
          key={shown}
          className="font-mono text-8xl font-bold text-accent tabular-nums motion-safe:animate-countdown sm:text-9xl"
          aria-live="assertive"
          data-testid="countdown-number"
        >
          {shown > 0 ? shown : 'GO!'}
        </div>
      ) : (
        <p className="animate-pulse text-ink-muted">Waiting for both players to connect…</p>
      )}
    </main>
  );
}

function PlayerTag({ player, label, side }) {
  return (
    <div
      className={`space-y-1 motion-safe:animate-fade-up ${side === 'rival' ? '[animation-delay:120ms]' : ''}`}
    >
      <p
        className={`font-display text-xl font-bold sm:text-2xl ${side === 'me' ? 'text-emerald-300' : 'text-sky-300'}`}
      >
        {player.ghost ? <GhostName ghost={player.ghost} compact /> : player.username}
      </p>
      <p className="font-mono text-sm text-ink-subtle">
        {player.elo} ELO{label ? ` · ${label}` : ''}
      </p>
    </div>
  );
}
