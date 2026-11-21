/**
 * Ghost and bot opponents (mode GHOST).
 *
 * A GHOST replays a real player's past RANKED run on a problem: the progress of each of their
 * submissions (tests passed, or best score % for FRONTEND), at the recorded offsets from the
 * start of their match. No code is ever replayed or shown. A BOT plays a synthetic timeline
 * from a difficulty profile; it is used when there is no ghost run at all.
 *
 * Both are always presented as what they are (descriptor `ghost: { kind: 'ghost' | 'bot', … }`).
 */

/** In-memory id of the ghost/bot player (real user ids start at 1). Also its result.winnerId. */
export const GHOST_PLAYER_ID = 0;
/** Ghost matches move the human's rating at half the ranked speed. */
export const GHOST_K_FACTOR = 16;
/** Rating windows tried in order: ±200, ±400, ±800, then any rating. */
export const GHOST_ELO_WINDOWS = [200, 400, 800, Infinity];

export const BOTS = Object.freeze([
  { id: 'byte', name: 'Byte', rating: 900 },
  { id: 'pixel', name: 'Pixel', rating: 1100 },
  { id: 'vector', name: 'Vector', rating: 1300 },
  { id: 'quantum', name: 'Quantum', rating: 1500 },
]);

/** The bot closest to a rating (ties → the weaker bot). */
export function pickBot(elo) {
  return BOTS.reduce((best, bot) =>
    Math.abs(bot.rating - elo) < Math.abs(best.rating - elo) ? bot : best,
  );
}

export const botById = (id) => BOTS.find((b) => b.id === id) ?? null;

/**
 * Picks a run: the narrowest rating window that has runs, then (when both exist) solved or
 * unsolved runs with equal chance, then a random run. runs: [{ elo, solved, … }].
 */
export function selectGhostRun(runs, { elo, random = Math.random, windows = GHOST_ELO_WINDOWS }) {
  for (const window of windows) {
    const pool = runs.filter((r) => Math.abs(r.elo - elo) <= window);
    if (pool.length === 0) continue;
    const solved = pool.filter((r) => r.solved);
    const unsolved = pool.filter((r) => !r.solved);
    const bucket =
      solved.length > 0 && unsolved.length > 0 ? (random() < 0.5 ? solved : unsolved) : pool;
    return bucket[Math.floor(random() * bucket.length)];
  }
  return null;
}

/**
 * Recorded submissions → replay events within the match duration, oldest first:
 * { offsetMs, accepted, passed, total, lines? } (ALGO/DEBUG) or { offsetMs, accepted, score,
 * charCount } (FRONTEND).
 */
export function ghostTimeline(submissions, { startedAt, durationMs, category }) {
  return submissions
    .map((s) => {
      const offsetMs = Math.max(0, new Date(s.createdAt).getTime() - new Date(startedAt).getTime());
      const accepted = s.status === 'ACCEPTED';
      if (category === 'FRONTEND') {
        return { offsetMs, accepted, score: Number(s.score ?? 0), charCount: s.charCount ?? null };
      }
      return {
        offsetMs,
        accepted,
        passed: s.passed,
        total: s.total,
        ...(category === 'DEBUG' && { lines: s.linesChanged ?? null }),
      };
    })
    .filter((e) => e.offsetMs < durationMs)
    .sort((a, b) => a.offsetMs - b.offsetMs);
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const DIFFICULTY_PENALTY = { EASY: 0, MEDIUM: 0.15, HARD: 0.3 };

/**
 * A bot's synthetic run. Stronger bots solve more often and sooner; harder problems lower both.
 * 1-3 partial submissions, then either a solve or a final partial result. Same event shape as
 * ghostTimeline().
 */
export function botTimeline({
  bot,
  category,
  difficulty,
  durationMs,
  testCount,
  threshold = 98,
  bugCount = 1,
  random = Math.random,
}) {
  const skill = (bot.rating - 700) / 1000; // 0.2 (Byte) … 0.8 (Quantum)
  const penalty = DIFFICULTY_PENALTY[difficulty] ?? 0.15;
  const solves = random() < clamp(0.35 + skill * 0.6 - penalty, 0.1, 0.9);
  const endFraction = clamp(
    0.85 - skill * 0.6 + penalty * 0.5 + (random() - 0.5) * 0.2,
    0.25,
    0.95,
  );
  const attempts = 1 + Math.floor(random() * 3);
  const chars = 150 + Math.floor(random() * 400);
  const lines = bugCount + Math.floor(random() * 2);

  const event = (fraction, progress, accepted) => {
    const offsetMs = Math.round(durationMs * fraction);
    if (category === 'FRONTEND') {
      const score = accepted
        ? Math.round((threshold + random() * (100 - threshold)) * 100) / 100
        : Math.round(Math.min(threshold - 0.5, 40 + progress * (threshold - 40)) * 100) / 100;
      return { offsetMs, accepted, score, charCount: chars };
    }
    const passed = accepted
      ? testCount
      : clamp(Math.round(testCount * progress), 0, Math.max(0, testCount - 1));
    return {
      offsetMs,
      accepted,
      passed,
      total: testCount,
      ...(category === 'DEBUG' && { lines }),
    };
  };

  const events = [];
  for (let k = 1; k <= attempts; k += 1) {
    events.push(event((endFraction * k) / (attempts + 1), 0.2 + (0.5 * k) / (attempts + 1), false));
  }
  events.push(event(endFraction, solves ? 1 : 0.6 + random() * 0.3, solves));
  return events;
}

/** The ghost/bot side of an archived GHOST match row (getMatch includes ghostUser + source). */
export function archivedGhost(row) {
  const bot = botById(row.botId);
  const ghost = bot
    ? { kind: 'bot', id: bot.id, name: bot.name, rating: row.player2Elo }
    : {
        kind: 'ghost',
        userId: row.ghostUser?.id ?? null,
        username: row.ghostUser?.username ?? 'deleted user',
        rating: row.player2Elo,
        replayOf: row.ghostSourceMatch?.endedAt?.toISOString?.() ?? null,
        sourceMatchId: row.ghostSourceMatchId,
      };
  return { id: GHOST_PLAYER_ID, username: bot ? bot.name : ghost.username, ghost };
}
