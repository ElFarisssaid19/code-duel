import Button from '@/components/Button.jsx';
import Modal from '@/components/Modal.jsx';
import { formatClock } from '@/components/match/format.js';

function headline(result, meId) {
  if (result.reason === 'CANCELLED')
    return { title: 'Match cancelled', tone: 'default', color: 'text-zinc-200' };
  if (result.winnerId === null) return { title: 'Draw', tone: 'default', color: 'text-zinc-100' };
  return result.winnerId === meId
    ? { title: 'Victory!', tone: 'success', color: 'text-emerald-400' }
    : { title: 'Defeat', tone: 'danger', color: 'text-red-400' };
}

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
  const { title, tone, color } = headline(result, meId);
  const elo = result.eloChanges?.[meId];
  const canRematch = result.mode === 'PRIVATE' && result.reason !== 'CANCELLED';

  return (
    <Modal open title={<span className={color}>{title}</span>} tone={tone}>
      <div className="space-y-5">
        <p className="text-sm text-zinc-300">{reasonText(result, meId, opponentName)}</p>

        {result.reason !== 'CANCELLED' && (
          <p className="text-sm">
            {elo ? (
              <>
                <span
                  className={`font-mono text-2xl font-bold ${elo.delta > 0 ? 'text-emerald-400' : elo.delta < 0 ? 'text-red-400' : 'text-zinc-300'}`}
                >
                  {elo.delta > 0 ? '+' : ''}
                  {elo.delta}
                </span>{' '}
                <span className="text-zinc-400">
                  ELO ({elo.before} → {elo.after})
                </span>
              </>
            ) : (
              <span className="text-zinc-400">Unranked match: no ELO change.</span>
            )}
          </p>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-zinc-500 uppercase">
              <th className="pb-2 font-medium">Player</th>
              <th className="pb-2 font-medium">Tests</th>
              <th className="pb-2 font-medium">Attempts</th>
              <th className="pb-2 text-right font-medium">Solve time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {result.summary.players.map((p) => (
              <tr key={p.userId} className={p.userId === meId ? 'text-zinc-100' : 'text-zinc-300'}>
                <td className="py-2 font-medium">
                  {p.username}
                  {p.userId === result.winnerId && (
                    <span className="ml-1.5 text-emerald-400">★</span>
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

        <div className="flex flex-wrap justify-end gap-2">
          {canRematch && (
            <RematchButton rematch={rematch} meId={meId} onRematch={onRematch} busy={rematchBusy} />
          )}
          <Button variant="secondary" onClick={onHome}>
            Back home
          </Button>
        </div>
      </div>
    </Modal>
  );
}
