import { formatClock } from '@/components/match/format.js';

/** Big countdown to endsAt (server time); red under one minute. */
export default function MatchTimer({ endsAt, now, offsetMs, stopped }) {
  const remaining = stopped ? 0 : endsAt - (now + offsetMs);
  const danger = !stopped && remaining < 60_000;
  return (
    <div
      className={`font-mono text-3xl font-bold tracking-tight tabular-nums sm:text-4xl ${danger ? 'animate-pulse text-red-400' : 'text-zinc-100'}`}
      role="timer"
      aria-label={`Time left ${formatClock(remaining)}`}
    >
      {formatClock(remaining)}
    </div>
  );
}
