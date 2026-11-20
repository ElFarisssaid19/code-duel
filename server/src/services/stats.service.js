import { prisma } from '../lib/prisma.js';

export const PUBLIC_STATS_TTL_MS = 60_000;

let cache = null; // { value, expiresAt }

/** Public numbers for the landing page, cached in memory for 60 s. 3 queries per refresh. */
export async function getPublicStats(now = Date.now()) {
  if (cache && cache.expiresAt > now) return cache.value;

  const [players, finishedMatches, byDifficulty] = await Promise.all([
    prisma.user.count(),
    prisma.match.count({ where: { status: 'FINISHED' } }),
    prisma.problem.groupBy({ by: ['difficulty'], _count: { _all: true } }),
  ]);
  const problems = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const row of byDifficulty) problems[row.difficulty] = row._count._all;

  const value = {
    players,
    finishedMatches,
    problems: { ...problems, total: problems.EASY + problems.MEDIUM + problems.HARD },
    generatedAt: new Date(now).toISOString(),
  };
  cache = { value, expiresAt: now + PUBLIC_STATS_TTL_MS };
  return value;
}

/** Tests only. */
export function resetPublicStatsCache() {
  cache = null;
}
