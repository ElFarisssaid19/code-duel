/** Database access for duels (Prisma). MatchManager only talks to the DB through this. */
import { prisma } from '../../lib/prisma.js';
import { START_ELO } from '../../lib/ratings.js';

const ACTIVE_STATUSES = ['WAITING', 'COUNTDOWN', 'ACTIVE'];

export function createMatchRepository(db = prisma) {
  return {
    /** { id, username, elo } with the user's ELO in `category` (1000 if they have no row yet). */
    async getUser(id, category = 'ALGO') {
      const user = await db.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          ratings: { where: { category }, select: { elo: true } },
        },
      });
      return (
        user && { id: user.id, username: user.username, elo: user.ratings[0]?.elo ?? START_ELO }
      );
    },

    /** Problems a match can use: one category, optionally one FRONTEND track. */
    listProblemCandidates: ({ category = 'ALGO', track = null } = {}) =>
      db.problem.findMany({
        where: { category, ...(track && { track }) },
        select: { id: true, difficulty: true },
      }),

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
      const base = {
        id: p.id,
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        category: p.category,
        description: p.description,
        starterCode: p.starterCode,
        ...(p.category === 'DEBUG' && { bugCount: p.bugCount }),
      };
      if (p.category === 'FRONTEND') {
        return {
          ...base,
          track: p.track,
          canvasWidth: p.canvasWidth,
          canvasHeight: p.canvasHeight,
          fixedHtml: p.fixedHtml,
          palette: p.palette,
          matchThreshold: p.matchThreshold === null ? null : Number(p.matchThreshold),
          targetImagePath: p.targetImagePath,
          tests: [],
        };
      }
      return {
        ...base,
        functionName: p.functionName,
        timeLimitMs: p.timeLimitMs,
        tests: p.testCases.map((t) => ({
          input: t.input,
          expected: t.expectedOutput,
          hidden: t.isHidden,
        })),
      };
    },

    /**
     * Ghost candidates: one entry per (finished RANKED match, player) of a category, never the
     * excluded user, only players who allow ghosts, only runs with at least one submission.
     * PRIVATE and GHOST matches are never used. Newest first, up to `limit` matches.
     * → [{ matchId, problemId, userId, username, elo, solved, startedAt, endedAt }]
     */
    async findGhostRuns({ category, track = null, excludeUserId, limit = 300 }) {
      const matches = await db.match.findMany({
        where: {
          mode: 'RANKED',
          status: 'FINISHED',
          category,
          startedAt: { not: null },
          ...(track && { problem: { track } }),
        },
        orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          problemId: true,
          testCount: true,
          startedAt: true,
          endedAt: true,
          player1Id: true,
          player2Id: true,
          player1Elo: true,
          player2Elo: true,
          player1Passed: true,
          player2Passed: true,
          player1: { select: { username: true, allowGhosts: true } },
          player2: { select: { username: true, allowGhosts: true } },
          submissions: { select: { userId: true }, distinct: ['userId'] },
        },
      });
      const runs = [];
      for (const m of matches) {
        const submitted = new Set(m.submissions.map((s) => s.userId));
        for (const n of [1, 2]) {
          const userId = m[`player${n}Id`];
          const user = m[`player${n}`];
          if (!user || userId === excludeUserId || !user.allowGhosts || !submitted.has(userId)) {
            continue;
          }
          runs.push({
            matchId: m.id,
            problemId: m.problemId,
            userId,
            username: user.username,
            elo: m[`player${n}Elo`],
            solved: m[`player${n}Passed`] === m.testCount,
            startedAt: m.startedAt,
            endedAt: m.endedAt,
          });
        }
      }
      return runs;
    },

    /** The submissions of one player in one match, oldest first (a ghost's replay timeline). */
    loadRunSubmissions: (matchId, userId) =>
      db.submission.findMany({
        where: { matchId, userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          createdAt: true,
          status: true,
          passed: true,
          total: true,
          score: true,
          charCount: true,
          linesChanged: true,
        },
      }),

    createMatch: (data) => db.match.create({ data, select: { id: true } }),

    updateMatch: (id, data) => db.match.update({ where: { id }, data, select: { id: true } }),

    /**
     * Ends a match: match row + (ranked) both users' rating in the match's category (ELO,
     * win/loss/draw, best ELO), in ONE transaction. The other category is never touched.
     * statUpdates: [{ userId, category, eloDelta, result: 'win' | 'loss' | 'draw' }].
     */
    finishMatch: (matchId, data, statUpdates = []) =>
      db.$transaction([
        ...statUpdates.map(({ userId, category = 'ALGO', eloDelta, result }) => {
          const [w, l, d] = [result === 'win', result === 'loss', result === 'draw'].map(Number);
          const start = START_ELO + eloDelta;
          // bestElo is assigned first, so it still sees the old elo (MySQL evaluates left to right).
          return db.$executeRaw`
            INSERT INTO UserRating (userId, category, elo, wins, losses, draws, bestElo)
            VALUES (${userId}, ${category}, ${start}, ${w}, ${l}, ${d}, ${Math.max(START_ELO, start)})
            ON DUPLICATE KEY UPDATE
              bestElo = GREATEST(bestElo, elo + ${eloDelta}),
              elo = elo + ${eloDelta},
              wins = wins + ${w},
              losses = losses + ${l},
              draws = draws + ${d}`;
        }),
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
          ghostUser: { select: { id: true, username: true } },
          ghostSourceMatch: { select: { endedAt: true } },
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
