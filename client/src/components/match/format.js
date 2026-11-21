/** 125000 → "2:05" */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export const REASON_LABELS = {
  SOLVED: 'Solved',
  TIMEOUT: 'Time is up',
  FORFEIT: 'Forfeit',
  DISCONNECT: 'Disconnect',
  CANCELLED: 'Cancelled',
};

/** Outcome of the match for this player: 'win' | 'loss' | 'draw' | 'cancelled'. */
export function outcomeOf(result, meId) {
  if (result.reason === 'CANCELLED') return 'cancelled';
  if (result.winnerId === null) return 'draw';
  return result.winnerId === meId ? 'win' : 'loss';
}

/** "Nov 2, 2026" */
export const formatDay = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

/**
 * How a ghost/bot opponent is named in sentences: "the ghost of @ana", "Bot Byte". Ghosts and
 * bots are never presented as live humans.
 */
export function opponentLabel(player) {
  if (player?.ghost?.kind === 'ghost') return `the ghost of @${player.ghost.username}`;
  if (player?.ghost?.kind === 'bot') return `Bot ${player.ghost.name}`;
  return player?.username ?? 'Your opponent';
}

/** Same, starting a sentence. */
export const opponentLabelStart = (player) => {
  const label = opponentLabel(player);
  return label.charAt(0).toUpperCase() + label.slice(1);
};
