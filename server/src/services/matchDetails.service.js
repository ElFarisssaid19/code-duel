/**
 * Match details. Summary + submission timeline are visible to every logged-in user; the final
 * code is a separate call, only for the two participants and only once the match is FINISHED.
 * Never includes test data (submissions only store counts and statuses).
 */
import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

const notFound = () => new HttpError(404, 'NOT_FOUND', 'Match not found');

/** Why `userId` may or may not see the code (null = allowed). */
export function codeAccess(match, userId) {
  if (match.player1Id !== userId && match.player2Id !== userId) return 'NOT_A_PARTICIPANT';
  if (match.status !== 'FINISHED') return 'MATCH_NOT_FINISHED';
  return null;
}

const CODE_ERRORS = {
  NOT_A_PARTICIPANT: 'Only the two players can see the code of this match.',
  MATCH_NOT_FINISHED: 'Code is only visible once the match has finished.',
};

/** GET /api/matches/:id. 1 query (+ relation loads). */
export async function getMatchDetails(matchId, viewerId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      player1: { select: { id: true, username: true } },
      player2: { select: { id: true, username: true } },
      problem: { select: { title: true, slug: true, difficulty: true } },
      submissions: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          userId: true,
          language: true,
          status: true,
          passed: true,
          total: true,
          createdAt: true,
        },
      },
    },
  });
  if (!match) throw notFound();

  const player = (n) => {
    const user = match[`player${n}`];
    const passed = match[`player${n}Passed`];
    const reachedAt = match[`player${n}ReachedAt`];
    const eloChange = match[`player${n}EloChange`];
    return {
      userId: user.id,
      username: user.username,
      eloBefore: match[`player${n}Elo`],
      eloChange,
      eloAfter: eloChange === null ? null : match[`player${n}Elo`] + eloChange,
      passed,
      result:
        match.status !== 'FINISHED'
          ? null
          : match.winnerId === null
            ? 'D'
            : match.winnerId === user.id
              ? 'W'
              : 'L',
      solveTimeMs:
        passed === match.testCount && reachedAt && match.startedAt
          ? reachedAt - match.startedAt
          : null,
    };
  };
  const access = codeAccess(match, viewerId);

  return {
    id: match.id,
    mode: match.mode,
    status: match.status,
    endReason: match.endReason,
    winnerId: match.winnerId,
    problem: match.problem,
    testCount: match.testCount,
    timeLimitMs: match.durationMs,
    durationMs: match.startedAt && match.endedAt ? match.endedAt - match.startedAt : null,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    players: [player(1), player(2)],
    timeline: match.submissions.map((s) => ({
      id: s.id,
      userId: s.userId,
      offsetMs: match.startedAt ? s.createdAt - match.startedAt : null,
      language: s.language,
      status: s.status,
      passed: s.passed,
      total: s.total,
    })),
    code: { available: access === null, reason: access },
  };
}

/** GET /api/matches/:id/code: each player's last submission. 403 unless allowed. 3 queries. */
export async function getMatchCode(matchId, viewerId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { status: true, player1Id: true, player2Id: true },
  });
  if (!match) throw notFound();
  const denied = codeAccess(match, viewerId);
  if (denied) throw new HttpError(403, denied, CODE_ERRORS[denied]);

  const last = (userId) =>
    prisma.submission.findFirst({
      where: { matchId, userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        language: true,
        code: true,
        status: true,
        passed: true,
        total: true,
        createdAt: true,
      },
    });
  const [one, two] = await Promise.all([last(match.player1Id), last(match.player2Id)]);
  return {
    players: [
      { userId: match.player1Id, submission: one },
      { userId: match.player2Id, submission: two },
    ],
  };
}
