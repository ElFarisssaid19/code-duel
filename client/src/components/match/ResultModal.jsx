import { Link } from 'react-router';
import UserLink from '@/components/UserLink.jsx';
import { formatClock, outcomeOf } from '@/components/match/format.js';
import Button from '@/components/ui/Button.jsx';
import Modal from '@/components/ui/Modal.jsx';

const HEADLINES = {
  win: {
    title: 'Victory!',
    tone: 'success',
    color: 'text-emerald-300',
    icon: '🏆',
    animation: 'motion-safe:animate-pop-in',
  },
  loss: {
    title: 'Defeat',
    tone: 'danger',
    color: 'text-red-300',
    icon: '',
    animation: 'motion-safe:animate-fade-up',
  },
  draw: {
    title: 'Draw',
    tone: 'default',
    color: 'text-ink',
    icon: '',
    animation: 'motion-safe:animate-fade-up',
  },
  cancelled: {
    title: 'Match cancelled',
    tone: 'default',
    color: 'text-zinc-200',
    icon: '',
    animation: '',
  },
};

function reasonText(result, meId, opponentName) {
  const won = result.winnerId === meId;
  switch (result.reason) {
    case 'SOLVED':
      return won ? 'You passed every test first.' : `${opponentName} passed every test first.`;
    case 'TIMEOUT':
      if (result.winnerId === null) return 'Time ran out with the same progress.';
      return won
        ? 'Time ran out and you passed more tests (or got there first).'
        : `Time ran out and ${opponentName} was ahead.`;
    case 'FORFEIT':
      return won ? `${opponentName} forfeited.` : 'You forfeited.';
    case 'DISCONNECT':
      return won
        ? `${opponentName} was disconnected for more than 30 seconds.`
        : 'You were disconnected for more than 30 seconds.';
    default:
      return 'A player did not connect in time.';
  }
}

function RematchButton({ rematch, meId, onRematch, busy }) {
  if (!rematch || ['expired', 'cancelled'].includes(rematch.status)) {
    return (
      <Button variant="secondary" disabled>
        Rematch unavailable
      </Button>
    );
  }
  const iAsked = rematch.requestedBy?.includes(meId);
  const theyAsked = rematch.requestedBy?.some((id) => id !== meId);
  if (iAsked) {
    return (
      <Button variant="secondary" disabled loading>
        Waiting for opponent…
      </Button>
    );
  }
  return (
    <Button onClick={onRematch} loading={busy}>
      {theyAsked ? 'Accept rematch' : 'Rematch'}
    </Button>
  );
}

/** End of match: outcome, reason, ELO change, final progress, rematch / home. */
export default function ResultModal({
  result,
  meId,
  opponentName,
  rematch,
  onRematch,
  rematchBusy,
  rematchError,
  onHome,
}) {
  const outcome = outcomeOf(result, meId);
  const { title, tone, color, icon, animation } = HEADLINES[outcome];
  const elo = result.eloChanges?.[meId];
  const canRematch = result.mode === 'PRIVATE' && result.reason !== 'CANCELLED';

  return (
    <Modal
      open
      tone={tone}
      className={outcome === 'loss' ? 'saturate-75' : ''}
      title={
        <span
          className={`inline-flex items-center gap-2 font-display text-2xl ${color} ${animation}`}
          data-testid="result-title"
          data-outcome={outcome}
        >
          {icon && <span aria-hidden="true">{icon}</span>}
          {title}
        </span>
      }
    >
      <div className={`space-y-5 ${animation ? 'motion-safe:animate-fade-up' : ''}`}>
        <p className="text-sm text-zinc-300">{reasonText(result, meId, opponentName)}</p>

        {result.reason !== 'CANCELLED' && (
          <p className="text-sm">
            {elo ? (
              <>
                <span
                  className={`font-mono text-3xl font-bold ${elo.delta > 0 ? 'text-emerald-300' : elo.delta < 0 ? 'text-red-300' : 'text-zinc-300'}`}
                >
                  {elo.delta > 0 ? '+' : ''}
                  {elo.delta}
                </span>{' '}
                <span className="text-ink-muted">
                  ELO ({elo.before} → {elo.after})
                </span>
              </>
            ) : (
              <span className="text-ink-muted">Unranked match: no ELO change.</span>
            )}
          </p>
        )}

        <table className="w-full text-sm">
          <caption className="sr-only">Final progress</caption>
          <thead>
            <tr className="text-left text-xs tracking-wide text-ink-subtle uppercase">
              <th scope="col" className="pb-2 font-medium">
                Player
              </th>
              <th scope="col" className="pb-2 font-medium">
                Tests
              </th>
              <th scope="col" className="pb-2 font-medium">
                Attempts
              </th>
              <th scope="col" className="pb-2 text-right font-medium">
                Solve time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.summary.players.map((p) => (
              <tr key={p.userId} className={p.userId === meId ? 'text-ink' : 'text-zinc-300'}>
                <td className="py-2 font-medium">
                  <UserLink username={p.username} />
                  {p.userId === result.winnerId && (
                    <span className="ml-1.5 text-emerald-300" aria-label="winner">
                      ★
                    </span>
                  )}
                </td>
                <td className="py-2 font-mono">
                  {p.passed}/{p.total}
                </td>
                <td className="py-2 font-mono">{p.attempts ?? '—'}</td>
                <td className="py-2 text-right font-mono">
                  {p.solveTimeMs !== null ? formatClock(p.solveTimeMs) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rematchError && <p className="text-sm text-red-300">{rematchError}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {result.reason !== 'CANCELLED' && (
            <Link
              to={`/matches/${result.matchId}`}
              className="mr-auto rounded text-sm font-medium text-accent hover:text-emerald-300"
            >
              View match details →
            </Link>
          )}
          {canRematch && (
            <RematchButton rematch={rematch} meId={meId} onRematch={onRematch} busy={rematchBusy} />
          )}
          <Button variant="secondary" onClick={onHome} data-autofocus>
            Back home
          </Button>
        </div>
      </div>
    </Modal>
  );
}
