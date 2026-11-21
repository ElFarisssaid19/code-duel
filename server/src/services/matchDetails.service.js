/**
 * Match details. Summary + submission timeline are visible to every logged-in user; the final
 * code is a separate call, only for the two participants and only once the match is FINISHED.
 * Never includes test data (submissions only store counts and statuses).
 *
 * FRONTEND matches also have scores, and final previews: each player's best submission rendered
 * to a PNG, visible to every logged-in user once the match is FINISHED (an image, not code;
 * never while the match is live).
 */
import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { applyTrackRules } from './frontend/trackRules.js';
import { archivedGhost, GHOST_PLAYER_ID } from './match/ghosts.js';
import { renderPage } from './renderer/index.js';

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
      ghostUser: { select: { id: true, username: true } },
      ghostSourceMatch: { select: { endedAt: true } },
      problem: {
        select: {
          title: true,
          slug: true,
          difficulty: true,
          track: true,
          canvasWidth: true,
          canvasHeight: true,
        },
      },
      submissions: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          userId: true,
          language: true,
          status: true,
          passed: true,
          total: true,
          score: true,
          charCount: true,
          linesChanged: true,
          createdAt: true,
        },
      },
    },
  });
  if (!match) throw notFound();
  const debug = match.category === 'DEBUG';
  // GHOST matches: the opponent is a replay or a bot, never a participant.
  const ghostSide = match.mode === 'GHOST' ? archivedGhost(match) : null;
  const winnerId = match.winnerIsGhost ? GHOST_PLAYER_ID : match.winnerId;
  const frontend = match.category === 'FRONTEND';
  const { track, canvasWidth, canvasHeight, ...problem } = match.problem;

  const player = (n) => {
    const user = match[`player${n}`] ?? ghostSide;
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
          : winnerId === null
            ? 'D'
            : winnerId === user.id
              ? 'W'
              : 'L',
      solveTimeMs:
        passed === match.testCount && reachedAt && match.startedAt
          ? reachedAt - match.startedAt
          : null,
      ...(frontend && {
        score: match[`player${n}Score`] === null ? 0 : Number(match[`player${n}Score`]),
        charCount: match[`player${n}Chars`],
      }),
      ...(debug && { linesChanged: match[`player${n}Lines`] }),
      ...(user.ghost && { ghost: user.ghost }),
    };
  };
  const access = codeAccess(match, viewerId);
  const finished = match.status === 'FINISHED';

  return {
    id: match.id,
    mode: match.mode,
    ...(frontend && {
      category: match.category,
      track,
      canvas: { width: canvasWidth, height: canvasHeight },
      previews: {
        available: finished,
        reason: finished ? null : 'MATCH_NOT_FINISHED',
        players: [match.player1Id, match.player2Id ?? GHOST_PLAYER_ID].map((userId) => ({
          userId,
          // A ghost/bot has no submission in this match: no preview.
          url:
            finished && userId !== GHOST_PLAYER_ID
              ? `/api/matches/${match.id}/preview/${userId}.png`
              : null,
        })),
      },
    }),
    ...(debug && { category: match.category }),
    status: match.status,
    endReason: match.endReason,
    winnerId,
    problem,
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
      ...(frontend && { score: s.score === null ? null : Number(s.score), charCount: s.charCount }),
      ...(debug && { linesChanged: s.linesChanged }),
    })),
    code: { available: access === null, reason: access },
  };
}

/** A player's best FRONTEND submission in a match: highest score, then fewer characters, then earliest. */
function bestFrontendSubmission(matchId, userId, select) {
  return prisma.submission.findFirst({
    where: { matchId, userId },
    orderBy: [{ score: 'desc' }, { charCount: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select,
  });
}

/** GET /api/matches/:id/code: each player's last submission. 403 unless allowed. 3 queries. */
export async function getMatchCode(matchId, viewerId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { status: true, player1Id: true, player2Id: true, category: true },
  });
  if (!match) throw notFound();
  const denied = codeAccess(match, viewerId);
  if (denied) throw new HttpError(403, denied, CODE_ERRORS[denied]);

  if (match.category === 'FRONTEND') {
    // The submission that counted: the best one (not the last).
    const best = (userId) =>
      bestFrontendSubmission(matchId, userId, {
        language: true,
        code: true,
        css: true,
        status: true,
        passed: true,
        total: true,
        score: true,
        charCount: true,
        createdAt: true,
      }).then((s) => s && { ...s, score: Number(s.score) });
    const [one, two] = await Promise.all([
      best(match.player1Id),
      match.player2Id === null ? null : best(match.player2Id),
    ]);
    return {
      players: [
        { userId: match.player1Id, submission: one },
        { userId: match.player2Id ?? GHOST_PLAYER_ID, submission: two },
      ],
    };
  }

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
        linesChanged: true,
        createdAt: true,
      },
    });
  const [one, two] = await Promise.all([
    last(match.player1Id),
    match.player2Id === null ? null : last(match.player2Id),
  ]);
  return {
    players: [
      { userId: match.player1Id, submission: one },
      // GHOST matches: no code is ever replayed or shown for the ghost/bot.
      { userId: match.player2Id ?? GHOST_PLAYER_ID, submission: two },
    ],
  };
}

const previewCache = new Map(); // submission id → PNG (finished matches never change)
const MAX_CACHED_PREVIEWS = 200;

/**
 * GET /api/matches/:id/preview/:userId.png: the player's best FRONTEND submission, rendered.
 * Any logged-in user, once the match is FINISHED. A player without submissions gets 404.
 */
export async function getMatchPreview(matchId, userId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      category: true,
      player1Id: true,
      player2Id: true,
      problem: { select: { track: true, fixedHtml: true, canvasWidth: true, canvasHeight: true } },
    },
  });
  if (!match || match.category !== 'FRONTEND') throw notFound();
  if (userId !== match.player1Id && userId !== match.player2Id) throw notFound();
  if (match.status !== 'FINISHED') {
    throw new HttpError(
      403,
      'MATCH_NOT_FINISHED',
      'Previews are only visible once the match has finished.',
    );
  }
  const submission = await bestFrontendSubmission(matchId, userId, {
    id: true,
    code: true,
    css: true,
  });
  if (!submission) throw new HttpError(404, 'NOT_FOUND', 'This player submitted nothing.');

  const cached = previewCache.get(submission.id);
  if (cached) return cached;
  const { problem } = match;
  const page = applyTrackRules(problem, { html: submission.code, css: submission.css ?? '' });
  const png = await renderPage({
    ...page,
    width: problem.canvasWidth,
    height: problem.canvasHeight,
  });
  if (previewCache.size >= MAX_CACHED_PREVIEWS)
    previewCache.delete(previewCache.keys().next().value);
  previewCache.set(submission.id, png);
  return png;
}
