/**
 * Public profiles, ELO history and match history. Every function runs a fixed number of
 * queries (no N+1), whatever the number of matches.
 */
import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { rankOf, START_ELO, winRate } from './leaderboard.service.js';

const notFound = () => new HttpError(404, 'NOT_FOUND', 'User not found');

async function findUser(username) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      elo: true,
      wins: true,
      losses: true,
      draws: true,
      createdAt: true,
    },
  });
  if (!user) throw notFound();
  return user;
}

/** The user's side of a match row. */
function side(match, userId) {
  const first = match.player1Id === userId;
  const p = first ? 'player1' : 'player2';
  const o = first ? 'player2' : 'player1';
  return {
    elo: match[`${p}Elo`],
    eloChange: match[`${p}EloChange`],
    passed: match[`${p}Passed`],
    reachedAt: match[`${p}ReachedAt`],
    opponentElo: match[`${o}Elo`],
    opponent: match[o],
    result: match.winnerId === null ? 'D' : match.winnerId === userId ? 'W' : 'L',
  };
}

/** Finished ranked matches, oldest first (ELO history, streaks, best ELO). 1 query. */
function rankedMatches(userId) {
  return prisma.match.findMany({
    where: {
      mode: 'RANKED',
      status: 'FINISHED',
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
    orderBy: [{ endedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      endedAt: true,
      winnerId: true,
      player1Id: true,
      player2Id: true,
      player1Elo: true,
      player2Elo: true,
      player1EloChange: true,
      player2EloChange: true,
    },
  });
}

/** Current streak (W or L; a draw ends it) and longest win streak, from results oldest → newest. */
export function computeStreaks(results) {
  let longestWin = 0;
  let run = 0;
  for (const r of results) {
    run = r === 'W' ? run + 1 : 0;
    longestWin = Math.max(longestWin, run);
  }
  const last = results.at(-1);
  let current = null;
  if (last === 'W' || last === 'L') {
    let count = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) count++;
    current = { type: last, count };
  }
  return { currentStreak: current, longestWinStreak: longestWin };
}

function eloPoints(user, matches) {
  return [
    { matchId: null, date: user.createdAt, elo: START_ELO, delta: 0 },
    ...matches
      .map((m) => ({ m, s: side(m, user.id) }))
      .filter(({ s }) => s.eloChange !== null)
      .map(({ m, s }) => ({
        matchId: m.id,
        date: m.endedAt,
        elo: s.elo + s.eloChange,
        delta: s.eloChange,
      })),
  ];
}

/** GET /api/users/:username/profile. 5 queries. */
export async function getProfile(username) {
  const user = await findUser(username);
  const [ranked, matches, languages, solvedRows] = await Promise.all([
    rankOf(user.id),
    rankedMatches(user.id),
    prisma.submission.groupBy({
      by: ['language'],
      where: { userId: user.id },
      _count: { language: true },
      orderBy: [{ _count: { language: 'desc' } }, { language: 'asc' }],
    }),
    // Distinct problems with an accepted submission (practice and matches), per difficulty.
    prisma.$queryRaw`
      SELECT p.difficulty AS difficulty, COUNT(DISTINCT s.problemId) AS solved
      FROM Submission s JOIN Problem p ON p.id = s.problemId
      WHERE s.userId = ${user.id} AND s.status = 'ACCEPTED'
      GROUP BY p.difficulty`,
  ]);

  const solved = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const row of solvedRows) solved[row.difficulty] = Number(row.solved);
  const results = matches.map((m) => side(m, user.id).result);
  const gamesPlayed = user.wins + user.losses + user.draws;

  return {
    username: user.username,
    elo: user.elo,
    rank: ranked?.rank ?? null,
    bestElo: Math.max(...eloPoints(user, matches).map((p) => p.elo), user.elo),
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    gamesPlayed,
    winRate: winRate(user.wins, gamesPlayed),
    ...computeStreaks(results),
    favoriteLanguage: languages[0]?.language ?? null,
    solved: { ...solved, total: solved.EASY + solved.MEDIUM + solved.HARD },
    memberSince: user.createdAt,
  };
}

/** GET /api/users/:username/elo-history: one point per ranked match, starting from 1000. 2 queries. */
export async function getEloHistory(username) {
  const user = await findUser(username);
  return { username: user.username, points: eloPoints(user, await rankedMatches(user.id)) };
}

const MODES = { all: undefined, ranked: 'RANKED', private: 'PRIVATE' };

/** GET /api/users/:username/matches: finished matches, newest first. 4 queries (+ relation loads). */
export async function getMatchHistory(username, { page, limit, mode }) {
  const user = await findUser(username);
  const where = {
    status: 'FINISHED',
    OR: [{ player1Id: user.id }, { player2Id: user.id }],
    ...(MODES[mode] && { mode: MODES[mode] }),
  };
  const [total, matches] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({
      where,
      orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        player1: { select: { username: true } },
        player2: { select: { username: true } },
        problem: { select: { title: true, slug: true, difficulty: true } },
      },
    }),
  ]);

  // Languages the user submitted with, for all matches of the page at once.
  const languageRows = matches.length
    ? await prisma.submission.groupBy({
        by: ['matchId', 'language'],
        where: { userId: user.id, matchId: { in: matches.map((m) => m.id) } },
        orderBy: [{ matchId: 'asc' }, { language: 'asc' }],
      })
    : [];
  const languagesByMatch = new Map();
  for (const { matchId, language } of languageRows) {
    languagesByMatch.set(matchId, [...(languagesByMatch.get(matchId) ?? []), language]);
  }

  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    matches: matches.map((m) => {
      const s = side(m, user.id);
      return {
        id: m.id,
        mode: m.mode,
        result: s.result,
        endReason: m.endReason,
        opponent: { username: s.opponent.username, elo: s.opponentElo },
        problem: m.problem,
        languages: languagesByMatch.get(m.id) ?? [],
        passed: s.passed,
        total: m.testCount,
        solveTimeMs:
          s.passed === m.testCount && s.reachedAt && m.startedAt ? s.reachedAt - m.startedAt : null,
        eloChange: s.eloChange,
        date: m.endedAt,
      };
    }),
  };
}
