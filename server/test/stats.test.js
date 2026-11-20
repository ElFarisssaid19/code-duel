import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { computeStreaks } from '../src/services/profile.service.js';
import { createMatch, createProblemRow, createUser } from './fixtures.js';
import { register, validUser } from './helpers.js';

let agent;
beforeEach(async () => {
  agent = request.agent(app);
  await register(agent); // validUser: 1000 ELO, no games → not on the leaderboard
});

// Counts every SQL query Prisma sends (query events are enabled in the test env).
let queryCount = 0;
prisma.$on('query', () => queryCount++);

/** Number of queries a request needs. */
async function queriesFor(path) {
  const start = queryCount;
  await agent.get(path);
  return queryCount - start;
}

describe('GET /api/leaderboard', () => {
  async function seedPlayers() {
    // Creation order matters for the tiebreak (oldest account first).
    await createUser('top_f', { elo: 1200, wins: 1 });
    await createUser('b_old', { elo: 1100, wins: 5, losses: 1 });
    await createUser('d_new', { elo: 1100, wins: 5, draws: 2 });
    await createUser('a_few', { elo: 1100, wins: 3 });
    await createUser('c_low', { elo: 1050, losses: 4 });
    await createUser('e_none', { elo: 1500 }); // never played ranked → excluded
  }

  it('orders by elo, wins, then oldest account; equal ELO shares a rank; excludes users without ranked games', async () => {
    await seedPlayers();
    const res = await agent.get('/api/leaderboard');

    expect(res.status).toBe(200);
    expect(res.body.entries.map((e) => [e.rank, e.username])).toEqual([
      [1, 'top_f'],
      [2, 'b_old'],
      [2, 'd_new'],
      [2, 'a_few'],
      [5, 'c_low'],
    ]);
    expect(res.body.entries[1]).toEqual({
      rank: 2,
      userId: expect.any(Number),
      username: 'b_old',
      elo: 1100,
      wins: 5,
      losses: 1,
      draws: 0,
      gamesPlayed: 6,
      winRate: 83.3,
    });
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 5, totalPages: 1, me: null });
  });

  it('paginates (ranks stay global) and returns my rank when I am not on the page', async () => {
    await seedPlayers();
    await prisma.userRating.updateMany({
      where: { user: { username: validUser.username }, category: 'ALGO' },
      data: { elo: 900, losses: 1 },
    });

    const page2 = await agent.get('/api/leaderboard?page=2&limit=2');
    expect(page2.body.entries.map((e) => [e.rank, e.username])).toEqual([
      [2, 'd_new'],
      [2, 'a_few'],
    ]);
    expect(page2.body).toMatchObject({ page: 2, limit: 2, total: 6, totalPages: 3 });
    expect(page2.body.me).toMatchObject({
      rank: 6,
      username: validUser.username,
      elo: 900,
      gamesPlayed: 1,
      winRate: 0,
      onPage: false,
    });

    const page3 = await agent.get('/api/leaderboard?page=3&limit=2');
    expect(page3.body.me.onPage).toBe(true);
  });

  it('validates page and limit (max 50) and requires auth', async () => {
    expect((await agent.get('/api/leaderboard?limit=51')).status).toBe(400);
    expect((await agent.get('/api/leaderboard?page=0')).status).toBe(400);
    expect((await request(app).get('/api/leaderboard')).status).toBe(401);
  });
});

describe('profiles, ELO history and match history', () => {
  let x;
  let y;
  let easy1;
  let easy2;
  let medium;
  let hard;

  /** x: ranked W W W W L W W (+ a private win, a cancelled ranked match), elo moves accordingly. */
  async function seedHistory() {
    x = await createUser('xavier', {
      elo: 1000 + 16 + 15 + 14 + 13 - 16 + 16 + 15,
      wins: 6,
      losses: 1,
    });
    y = await createUser('yolanda', { elo: 1000 - 73, wins: 1, losses: 6 });
    [easy1, easy2, medium, hard] = await Promise.all([
      createProblemRow('e1', 'EASY'),
      createProblemRow('e2', 'EASY'),
      createProblemRow('m1', 'MEDIUM'),
      createProblemRow('h1', 'HARD'),
    ]);
    const deltas = [16, 15, 14, 13, -16, 16, 15];
    let elo = 1000;
    for (const [i, delta] of deltas.entries()) {
      await createMatch({
        a: x,
        b: y,
        problem: i % 2 ? easy1 : medium,
        winner: delta > 0 ? x : y,
        delta,
        minute: i * 10,
        aElo: elo,
        bElo: 2000 - elo,
        aPassed: delta > 0 ? 5 : 2,
        bPassed: delta > 0 ? 1 : 5,
      });
      elo += delta;
    }
    await createMatch({
      a: y,
      b: x,
      problem: hard,
      winner: x,
      mode: 'PRIVATE',
      minute: 100,
      bPassed: 5,
    });
    await createMatch({
      a: x,
      b: y,
      problem: easy2,
      winner: null,
      status: 'CANCELLED',
      minute: 110,
    });
  }

  it('profile: stats, win rate, streaks, best ELO, favorite language, solved by difficulty', async () => {
    await seedHistory();
    // Submissions: python ×3, javascript ×2. Accepted: e1 twice (duplicate) + e2 + m1; h1 never.
    const sub = (problem, language, status, matchId = null) =>
      prisma.submission.create({
        data: {
          userId: x.id,
          problemId: problem.id,
          language,
          code: 'x',
          status,
          passed: 1,
          total: 1,
          matchId,
        },
      });
    await sub(easy1, 'python', 'ACCEPTED');
    await sub(easy1, 'python', 'ACCEPTED');
    await sub(easy2, 'javascript', 'ACCEPTED');
    await sub(medium, 'python', 'ACCEPTED');
    await sub(hard, 'javascript', 'WRONG_ANSWER');

    const res = await agent.get('/api/users/xavier/profile');

    expect(res.status).toBe(200);
    expect(res.body.profile).toEqual({
      username: 'xavier',
      elo: 1073,
      rank: 1,
      bestElo: 1073, // 1000 → 1016 → 1031 → 1045 → 1058 → 1042 → 1058 → 1073
      wins: 6,
      losses: 1,
      draws: 0,
      gamesPlayed: 7,
      winRate: 85.7,
      currentStreak: { type: 'W', count: 2 },
      longestWinStreak: 4,
      favoriteLanguage: 'python',
      solved: { EASY: 2, MEDIUM: 1, HARD: 0, total: 3 },
      memberSince: expect.any(String),
    });
  });

  it('ELO history: one point per finished ranked match, in order, starting from 1000', async () => {
    await seedHistory();
    const res = await agent.get('/api/users/xavier/elo-history');

    expect(res.body.points.map((p) => p.elo)).toEqual([
      1000, 1016, 1031, 1045, 1058, 1042, 1058, 1073,
    ]);
    expect(res.body.points[0]).toMatchObject({ matchId: null, delta: 0 });
    expect(res.body.points.slice(1).every((p) => p.matchId && p.date)).toBe(true);
    const dates = res.body.points.slice(1).map((p) => new Date(p.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
    // The opponent's mirror image.
    const yHistory = await agent.get('/api/users/yolanda/elo-history');
    expect(yHistory.body.points.at(-1).elo).toBe(2000 - 1058 - 15);
  });

  it('match history: newest first, mode filter, pagination, opponent ELO at start, languages, solve time', async () => {
    await seedHistory();
    const lastRanked = await prisma.match.findFirst({
      where: { mode: 'RANKED', status: 'FINISHED' },
      orderBy: { endedAt: 'desc' },
    });
    await prisma.submission.createMany({
      data: ['javascript', 'python', 'python'].map((language) => ({
        userId: x.id,
        problemId: easy1.id,
        matchId: lastRanked.id,
        language,
        code: 'x',
        status: 'WRONG_ANSWER',
        passed: 0,
        total: 5,
      })),
    });

    const all = await agent.get('/api/users/xavier/matches');
    expect(all.body).toMatchObject({ total: 8, page: 1, totalPages: 1 }); // cancelled excluded
    expect(all.body.matches[0]).toMatchObject({
      mode: 'PRIVATE',
      result: 'W',
      eloChange: null,
      problem: { slug: 'h1', difficulty: 'HARD' },
    });
    expect(all.body.matches[1]).toEqual({
      id: lastRanked.id,
      mode: 'RANKED',
      result: 'W',
      endReason: 'SOLVED',
      opponent: { username: 'yolanda', elo: 2000 - 1058 },
      problem: { title: 'Problem m1', slug: 'm1', difficulty: 'MEDIUM' },
      languages: ['javascript', 'python'],
      passed: 5,
      total: 5,
      solveTimeMs: 2 * 60_000,
      eloChange: 15,
      date: expect.any(String),
    });

    const ranked = await agent.get('/api/users/xavier/matches?mode=ranked&limit=3&page=2');
    expect(ranked.body).toMatchObject({ total: 7, totalPages: 3, page: 2 });
    // Ranked deltas, newest first: 15, 16, -16 | 13, 14, 15 | 16
    expect(ranked.body.matches.map((m) => m.eloChange)).toEqual([13, 14, 15]);
    const priv = await agent.get('/api/users/xavier/matches?mode=private');
    expect(priv.body.matches.map((m) => m.mode)).toEqual(['PRIVATE']);
    expect((await agent.get('/api/users/xavier/matches?mode=weird')).status).toBe(400);
  });

  it('best ELO is the peak, not the current rating; a losing streak is reported', async () => {
    const p = await createUser('peaky', { elo: 1010, wins: 1, losses: 2 });
    const q = await createUser('opp_q');
    const problem = await createProblemRow('pk');
    let elo = 1000;
    for (const [i, delta] of [20, -5, -5].entries()) {
      await createMatch({
        a: p,
        b: q,
        problem,
        winner: delta > 0 ? p : q,
        delta,
        minute: i * 10,
        aElo: elo,
      });
      elo += delta;
    }
    const profile = (await agent.get('/api/users/peaky/profile')).body.profile;
    expect(profile).toMatchObject({
      elo: 1010,
      bestElo: 1020,
      currentStreak: { type: 'L', count: 2 },
      longestWinStreak: 1,
      winRate: 33.3,
    });
  });

  it('private matches are excluded from ranked stats', async () => {
    const p = await createUser('pat');
    const q = await createUser('quinn');
    const problem = await createProblemRow('pp');
    await createMatch({ a: p, b: q, problem, winner: p, mode: 'PRIVATE' });

    const profile = (await agent.get('/api/users/pat/profile')).body.profile;
    expect(profile).toMatchObject({
      wins: 0,
      gamesPlayed: 0,
      winRate: 0,
      rank: null,
      bestElo: 1000,
      currentStreak: null,
      longestWinStreak: 0,
    });
    expect((await agent.get('/api/users/pat/elo-history')).body.points).toHaveLength(1);
    expect((await agent.get('/api/users/pat/matches')).body.total).toBe(1); // still in the history
  });

  it('returns 404 for unknown or invalid usernames', async () => {
    for (const path of [
      '/api/users/nobody_here/profile',
      '/api/users/nobody_here/matches',
      '/api/users/nobody_here/elo-history',
      '/api/users/bad%20name/profile',
    ]) {
      const res = await agent.get(path);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('runs a bounded number of queries (no N+1)', async () => {
    await seedHistory(); // xavier: 9 matches
    const z = await createUser('zed', { elo: 1100, wins: 30 });
    const problem = await createProblemRow('zz');
    for (let i = 0; i < 30; i++) await createMatch({ a: z, b: y, problem, winner: z, minute: i });

    for (const path of ['profile', 'elo-history', 'matches?limit=50']) {
      const few = await queriesFor(`/api/users/xavier/${path}`);
      const many = await queriesFor(`/api/users/zed/${path}`);
      expect(many, path).toBe(few);
      expect(few, path).toBeLessThanOrEqual(8);
    }
  });
});

describe('computeStreaks', () => {
  it.each([
    [[], null, 0],
    [['W'], { type: 'W', count: 1 }, 1],
    [['W', 'W', 'L', 'L', 'L'], { type: 'L', count: 3 }, 2],
    [['W', 'W', 'D'], null, 2],
    [['W', 'D', 'W', 'W', 'W', 'L', 'W'], { type: 'W', count: 1 }, 3],
  ])('%j → current %j, longest win %i', (results, current, longest) => {
    expect(computeStreaks(results)).toEqual({ currentStreak: current, longestWinStreak: longest });
  });
});
