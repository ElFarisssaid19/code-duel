/** Database access for duels (Prisma). MatchManager only talks to the DB through this. */
import { prisma } from '../../lib/prisma.js';

const ACTIVE_STATUSES = ['WAITING', 'COUNTDOWN', 'ACTIVE'];

export function createMatchRepository(db = prisma) {
  return {
    getUser: (id) =>
      db.user.findUnique({ where: { id }, select: { id: true, username: true, elo: true } }),

    listProblemCandidates: () => db.problem.findMany({ select: { id: true, difficulty: true } }),

    /** Problem ids from each user's last `limit` matches. */
    async recentProblemIds(userIds, limit) {
      const rows = await Promise.all(
        userIds.map((id) =>
          db.match.findMany({
            where: { OR: [{ player1Id: id }, { player2Id: id }] },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: { problemId: true },
          }),
        ),
      );
      return new Set(rows.flat().map((r) => r.problemId));
    },

    /** Everything needed to run a match. `tests` include hidden ones: never send them to clients. */
    async loadProblem(id) {
      const p = await db.problem.findUnique({
        where: { id },
        include: { testCases: { orderBy: { order: 'asc' } } },
      });
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        description: p.description,
        starterCode: p.starterCode,
        functionName: p.functionName,
        timeLimitMs: p.timeLimitMs,
        tests: p.testCases.map((t) => ({
          input: t.input,
          expected: t.expectedOutput,
          hidden: t.isHidden,
        })),
      };
    },

    createMatch: (data) => db.match.create({ data, select: { id: true } }),

    updateMatch: (id, data) => db.match.update({ where: { id }, data, select: { id: true } }),

    /**
     * Ends a match: match row + (ranked) both users' ELO and win/loss/draw counters, in ONE
     * transaction. statUpdates: [{ userId, eloDelta, result: 'win' | 'loss' | 'draw' }].
     */
    finishMatch: (matchId, data, statUpdates = []) =>
      db.$transaction([
        ...statUpdates.map(({ userId, eloDelta, result }) =>
          db.user.update({
            where: { id: userId },
            data: {
              elo: { increment: eloDelta },
              ...(result === 'win' && { wins: { increment: 1 } }),
              ...(result === 'loss' && { losses: { increment: 1 } }),
              ...(result === 'draw' && { draws: { increment: 1 } }),
            },
          }),
        ),
        db.match.update({ where: { id: matchId }, data }),
      ]),

    saveSubmission: (data) => db.submission.create({ data, select: { id: true, createdAt: true } }),

    /** A finished/cancelled match, for rejoining after it was dropped from memory. */
    getMatch: (id) =>
      db.match.findUnique({
        where: { id },
        include: {
          player1: { select: { id: true, username: true } },
          player2: { select: { id: true, username: true } },
        },
      }),

    /** On server start: in-memory state is gone, so unfinished matches can't continue. */
    cancelStaleMatches: () =>
      db.match.updateMany({
        where: { status: { in: ACTIVE_STATUSES } },
        data: { status: 'CANCELLED', endReason: 'CANCELLED', endedAt: new Date() },
      }),
  };
}
