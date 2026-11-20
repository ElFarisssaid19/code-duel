/** Direct-to-DB fixtures for stats tests (users with given stats, finished matches). */
import { prisma } from '../src/lib/prisma.js';

let seq = 0;
const at = (minutes) => new Date(Date.UTC(2026, 0, 1, 12, minutes));

/**
 * A user. Rating fields (elo, wins, losses, draws, bestElo) go to their ALGO UserRating row;
 * `frontend: { … }` sets the FRONTEND row the same way. Returns the user with `elo` (ALGO).
 */
export async function createUser(username, data = {}) {
  seq += 1;
  const { elo, wins, losses, draws, bestElo, frontend, ...userData } = data;
  const algo = { elo, wins, losses, draws, bestElo };
  const user = await prisma.user.create({
    data: {
      username,
      email: `${username}@stats.test`,
      passwordHash: 'x',
      createdAt: at(-1000 + seq),
      ...userData,
      ratings: {
        create: [
          { category: 'ALGO', ...algo },
          { category: 'FRONTEND', ...frontend },
        ],
      },
    },
  });
  return { ...user, elo: elo ?? 1000 };
}

/** A user's rating row in a category (ALGO by default). */
export const ratingOf = (userId, category = 'ALGO') =>
  prisma.userRating.findUnique({ where: { userId_category: { userId, category } } });

export function createProblemRow(slug, difficulty = 'EASY') {
  return prisma.problem.create({
    data: {
      slug,
      title: `Problem ${slug}`,
      description: 'x',
      difficulty,
      starterCode: { javascript: '', python: '' },
      functionName: { javascript: 'f', python: 'f' },
    },
  });
}

/**
 * A match between a and b. `winner`: a | b | null (draw). Deltas are for a (b gets the opposite)
 * in ranked mode. `minute` orders matches in time.
 */
export function createMatch({
  a,
  b,
  problem,
  winner,
  mode = 'RANKED',
  delta = 16,
  minute = 0,
  status = 'FINISHED',
  aPassed = 0,
  bPassed = 0,
  testCount = 5,
  aElo = 1000,
  bElo = 1000,
}) {
  const ranked = mode === 'RANKED' && status === 'FINISHED';
  const endReason = status === 'FINISHED' ? 'SOLVED' : status === 'CANCELLED' ? 'CANCELLED' : null;
  return prisma.match.create({
    data: {
      mode,
      status,
      endReason,
      player1Id: a.id,
      player2Id: b.id,
      problemId: problem.id,
      winnerId: winner ? winner.id : null,
      durationMs: 600_000,
      testCount,
      player1Elo: aElo,
      player2Elo: bElo,
      player1EloChange: ranked ? delta : null,
      player2EloChange: ranked ? -delta : null,
      player1Passed: aPassed,
      player2Passed: bPassed,
      player1ReachedAt: aPassed ? at(minute + 2) : null,
      player2ReachedAt: bPassed ? at(minute + 3) : null,
      createdAt: at(minute),
      startedAt: at(minute),
      endsAt: at(minute + 10),
      endedAt: status === 'FINISHED' ? at(minute + 5) : null,
    },
  });
}
