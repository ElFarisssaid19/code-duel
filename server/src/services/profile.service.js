/**
 * Public profiles, ELO history and match history, per category (ALGO | FRONTEND). Every
 * function runs a fixed number of queries (no N+1), whatever the number of matches.
 */
import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { ratingSelect, ratingsByCategory } from '../lib/ratings.js';
import { rankOf, START_ELO, winRate } from './leaderboard.service.js';
import { archivedGhost } from './match/ghosts.js';

const notFound = () => new HttpError(404, 'NOT_FOUND', 'User not found');

/** The user (+ their ratings when `withRatings`: that's one more query, only the profile needs it). */
async function findUser(username, { withRatings = false } = {}) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      createdAt: true,
      ...(withRatings && { ratings: { select: ratingSelect } }),
    },
  });
  if (!user) throw notFound();
  return withRatings ? { ...user, ratings: ratingsByCategory(user.ratings) } : user;
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
    score: match[`${p}Score`],
    lines: match[`${p}Lines`],
    opponentElo: match[`${o}Elo`],
    opponent: match[o],
    // GHOST matches: a ghost/bot win is stored as winnerIsGhost (winnerId is null).
    result: match.winnerIsGhost
      ? 'L'
      : match.winnerId === null
        ? 'D'
        : match.winnerId === userId
          ? 'W'
          : 'L',
  };
}

/** Rated matches: RANKED and GHOST (only the human's rating changes in GHOST matches). */
const RATED_MODES = ['RANKED', 'GHOST'];

/**
 * Finished rated matches (ranked + ghost) of a category, oldest first (ELO history, streaks,
 * best ELO). 1 query.
 */
function rankedMatches(userId, category) {
  return prisma.match.findMany({
    where: {
      mode: { in: RATED_MODES },
      status: 'FINISHED',
      category,
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
    orderBy: [{ endedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      endedAt: true,
      winnerId: true,
      winnerIsGhost: true,
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

/**
 * GET /api/users/:username/profile?category=ALGO|FRONTEND. Same shape for both categories:
 * rating, rank, streaks and the ELO history are the category's; favoriteLanguage and solved only
 * count that category's problems (FRONTEND "languages" are the tracks: html, css, html_css).
 */
export async function getProfile(username, category = 'ALGO') {
  const user = await findUser(username, { withRatings: true });
  const rating = user.ratings[category];
  const [ranked, matches, languages, solvedRows] = await Promise.all([
    rankOf(user.id, category),
    rankedMatches(user.id, category),
    prisma.submission.groupBy({
      by: ['language'],
      where: { userId: user.id, problem: { category } },
      _count: { language: true },
      orderBy: [{ _count: { language: 'desc' } }, { language: 'asc' }],
    }),
    // Distinct problems with an accepted submission (practice and matches), per difficulty.
    prisma.$queryRaw`
      SELECT p.difficulty AS difficulty, COUNT(DISTINCT s.problemId) AS solved
      FROM Submission s JOIN Problem p ON p.id = s.problemId
      WHERE s.userId = ${user.id} AND s.status = 'ACCEPTED' AND p.category = ${category}
      GROUP BY p.difficulty`,
  ]);

  const solved = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const row of solvedRows) solved[row.difficulty] = Number(row.solved);
  const results = matches.map((m) => side(m, user.id).result);
  const gamesPlayed = rating.wins + rating.losses + rating.draws;

  return {
    username: user.username,
    elo: rating.elo,
    rank: ranked?.rank ?? null,
    bestElo: Math.max(...eloPoints(user, matches).map((p) => p.elo), rating.elo, rating.bestElo),
    wins: rating.wins,
    losses: rating.losses,
    draws: rating.draws,
    gamesPlayed,
    winRate: winRate(rating.wins, gamesPlayed),
    ...computeStreaks(results),
    favoriteLanguage: languages[0]?.language ?? null,
    solved: { ...solved, total: solved.EASY + solved.MEDIUM + solved.HARD },
    memberSince: user.createdAt,
  };
}

/** GET /api/users/:username/elo-history?category=: one point per ranked match, from 1000. 2 queries. */
export async function getEloHistory(username, category = 'ALGO') {
  const user = await findUser(username);
  return {
    username: user.username,
    category,
    points: eloPoints(user, await rankedMatches(user.id, category)),
  };
}

const MODES = { all: undefined, ranked: 'RANKED', private: 'PRIVATE', ghost: 'GHOST' };

/**
 * GET /api/users/:username/matches: finished matches, newest first, optionally of one category.
 * FRONTEND entries also carry category, track and score (the user's best score). 4 queries
 * (+ relation loads).
 */
export async function getMatchHistory(username, { page, limit, mode, category }) {
  const user = await findUser(username);
  const where = {
    status: 'FINISHED',
    OR: [{ player1Id: user.id }, { player2Id: user.id }],
    ...(MODES[mode] && { mode: MODES[mode] }),
    ...(category && { category }),
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
        problem: { select: { title: true, slug: true, difficulty: true, track: true } },
      },
    }),
  ]);

  // Ghost/bot details, in one more query and only when the page has GHOST matches.
  const ghostIds = matches.filter((m) => m.mode === 'GHOST').map((m) => m.id);
  const ghostRows = ghostIds.length
    ? await prisma.match.findMany({
        where: { id: { in: ghostIds } },
        select: {
          id: true,
          botId: true,
          player2Elo: true,
          ghostSourceMatchId: true,
          ghostUser: { select: { id: true, username: true } },
          ghostSourceMatch: { select: { endedAt: true } },
        },
      })
    : [];
  const ghostById = new Map(ghostRows.map((row) => [row.id, row]));

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
      const { track, ...problem } = m.problem;
      return {
        id: m.id,
        mode: m.mode,
        ...(m.category === 'FRONTEND' && {
          category: m.category,
          track,
          score: s.score === null ? null : Number(s.score),
        }),
        ...(m.category === 'DEBUG' && { category: m.category, linesChanged: s.lines }),
        result: s.result,
        endReason: m.endReason,
        opponent:
          m.mode === 'GHOST'
            ? { ...ghostOpponent(ghostById.get(m.id)), elo: s.opponentElo }
            : { username: s.opponent.username, elo: s.opponentElo },
        problem,
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

/** The ghost/bot opponent of a GHOST match (always labelled as such). */
function ghostOpponent(match) {
  const { username, ghost } = archivedGhost(match);
  return { username, ghost };
}

/**
 * GET /api/users/:username/opponents?category=: W/L/D against real players (RANKED) and against
 * ghosts/bots (GHOST), finished matches only. 2 queries.
 */
export async function getOpponentBreakdown(username, category = 'ALGO') {
  const user = await findUser(username);
  const matches = await prisma.match.findMany({
    where: {
      status: 'FINISHED',
      category,
      mode: { in: RATED_MODES },
      OR: [{ player1Id: user.id }, { player2Id: user.id }],
    },
    select: { mode: true, winnerId: true, winnerIsGhost: true, player1Id: true, player2Id: true },
  });
  const empty = () => ({ wins: 0, losses: 0, draws: 0, games: 0 });
  const breakdown = { vsPlayers: empty(), vsGhosts: empty() };
  const KEY = { W: 'wins', L: 'losses', D: 'draws' };
  for (const m of matches) {
    const bucket = m.mode === 'GHOST' ? breakdown.vsGhosts : breakdown.vsPlayers;
    bucket[KEY[side(m, user.id).result]] += 1;
    bucket.games += 1;
  }
  return { username: user.username, category, ...breakdown };
}
