/**
 * What a share card says, from the SHARER's point of view. Built only from the match summary:
 * never code, never test data.
 */
import { archivedGhost, GHOST_PLAYER_ID } from '../match/ghosts.js';

const CATEGORY_LABELS = { ALGO: 'Algorithms', FRONTEND: 'Frontend', DEBUG: 'Debug' };
const DIFFICULTY_LABELS = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };
const MODE_LABELS = { RANKED: 'Ranked duel', PRIVATE: 'Private duel', GHOST: 'Ghost duel' };

const clock = (ms) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** match: a Match row with player1, player2, ghostUser, ghostSourceMatch and problem. */
export function buildShareSummary(match, userId) {
  const me = match.player1Id === userId ? 1 : 2;
  const them = me === 1 ? 2 : 1;
  const ghostSide = match.mode === 'GHOST' ? archivedGhost(match) : null;
  const opponentUser = match[`player${them}`] ?? ghostSide;
  const winnerId = match.winnerIsGhost ? GHOST_PLAYER_ID : match.winnerId;
  const outcome = winnerId === null ? 'DRAW' : winnerId === userId ? 'VICTORY' : 'DEFEAT';
  const won = outcome === 'VICTORY';
  const opponentName = ghostSide
    ? ghostSide.ghost.kind === 'bot'
      ? `Bot ${ghostSide.username}`
      : `the ghost of ${ghostSide.username}`
    : opponentUser.username;

  const reason =
    {
      SOLVED: won ? 'Solved it first' : `${opponentName} solved it first`,
      TIMEOUT:
        outcome === 'DRAW'
          ? 'Time ran out: a draw'
          : won
            ? 'Ahead when time ran out'
            : 'Behind when time ran out',
      FORFEIT: won ? `${opponentName} forfeited` : 'Forfeited',
      DISCONNECT: won ? `${opponentName} disconnected` : 'Disconnected',
    }[match.endReason] ?? 'Match over';

  const passed = match[`player${me}Passed`];
  const reachedAt = match[`player${me}ReachedAt`];
  let stat;
  if (match.category === 'FRONTEND') {
    const score = match[`player${me}Score`];
    stat = `Best score ${Number(score ?? 0).toFixed(2)}%`;
  } else if (passed === match.testCount && reachedAt && match.startedAt) {
    stat = `Solved in ${clock(new Date(reachedAt) - new Date(match.startedAt))}`;
  } else {
    stat = `${passed}/${match.testCount} tests passed`;
  }
  const lines = match[`player${me}Lines`];
  if (match.category === 'DEBUG' && lines !== null && lines !== undefined) {
    stat += ` · ${lines} line${lines === 1 ? '' : 's'} changed`;
  }

  const eloChange = match[`player${me}EloChange`];
  return {
    mode: MODE_LABELS[match.mode] ?? 'Duel',
    category: CATEGORY_LABELS[match.category] ?? match.category,
    problem: match.problem.title,
    difficulty: DIFFICULTY_LABELS[match.problem.difficulty] ?? match.problem.difficulty,
    outcome,
    reason,
    stat,
    eloChange: eloChange ?? null,
    me: { username: match[`player${me}`].username, elo: match[`player${me}Elo`] },
    opponent: {
      username: opponentUser.username,
      elo: match[`player${them}Elo`],
      badge: ghostSide ? ghostSide.ghost.kind : null, // 'ghost' | 'bot' | null
    },
    date: new Date(match.endedAt ?? match.createdAt).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
  };
}
