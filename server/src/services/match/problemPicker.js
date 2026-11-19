export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
export const ROOM_DIFFICULTIES = [...DIFFICULTIES, 'ANY'];
/** How many recent matches per player to avoid repeating problems from. */
export const RECENT_MATCHES = 5;

/** Ranked difficulty from the players' average ELO. */
export function rankedDifficulties(averageElo) {
  if (averageElo < 1100) return ['EASY'];
  if (averageElo < 1300) return ['EASY', 'MEDIUM'];
  return ['MEDIUM', 'HARD'];
}

/** Private room choice → allowed difficulties. */
export const privateDifficulties = (choice) => (choice === 'ANY' ? DIFFICULTIES : [choice]);

/**
 * Picks a problem from candidates ([{ id, difficulty }]). Prefers the allowed difficulties and
 * problems neither player saw recently (recentIds), then relaxes: recent problems are allowed
 * before giving up. Unless `strict`, any difficulty is used as a last resort (ranked must always
 * find a problem, e.g. when no HARD problems exist).
 */
export function chooseProblem({
  candidates,
  difficulties,
  recentIds = new Set(),
  strict = false,
  random = Math.random,
}) {
  const allowed = candidates.filter((p) => difficulties.includes(p.difficulty));
  const fresh = (pool) => pool.filter((p) => !recentIds.has(p.id));
  const pools = [fresh(allowed), allowed, ...(strict ? [] : [fresh(candidates), candidates])];
  const pool = pools.find((p) => p.length > 0);
  return pool ? pool[Math.floor(random() * pool.length)] : null;
}
