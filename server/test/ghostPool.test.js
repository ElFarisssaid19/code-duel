/**
 * Ghost pool (real DB query) and the API around ghost matches: opt-out toggle, history,
 * vs players / vs ghosts breakdown, match details that always flag the ghost/bot.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createMatchRepository } from '../src/services/match/matchRepository.js';
import { createMatch, createProblemRow, createUser } from './fixtures.js';
import { register } from './helpers.js';

const repo = createMatchRepository();
let me;
let ghost;
let shy;
let problem;

/** A finished ranked (or other mode) match with one submission per listed player. */
async function playedMatch({ a, b, mode = 'RANKED', submitters = [a, b], minute = 0, aElo, bElo }) {
  const match = await createMatch({
    a,
    b,
    problem,
    winner: a,
    mode,
    minute,
    aElo,
    bElo,
    aPassed: 5,
    bPassed: 2,
  });
  for (const [i, user] of submitters.entries()) {
    await prisma.submission.create({
      data: {
        matchId: match.id,
        userId: user.id,
        problemId: problem.id,
        language: 'javascript',
        code: 'SECRET_GHOST_CODE',
        status: user === a ? 'ACCEPTED' : 'WRONG_ANSWER',
        passed: user === a ? 5 : 2,
        total: 5,
        createdAt: new Date(match.startedAt.getTime() + (i + 1) * 30_000),
      },
    });
  }
  return match;
}

beforeEach(async () => {
  me = await createUser('me_player');
  ghost = await createUser('ghost_ok');
  shy = await createUser('shy_one', { allowGhosts: false });
  problem = await createProblemRow('gp1');
});

describe('findGhostRuns (real query)', () => {
  it('excludes opted-out users, private matches, the player own runs and runs without submissions', async () => {
    const ranked = await playedMatch({ a: ghost, b: shy, aElo: 1040, bElo: 990 });
    await playedMatch({ a: ghost, b: shy, mode: 'PRIVATE', minute: 20 });
    const mine = await playedMatch({ a: me, b: ghost, minute: 40, submitters: [me] });

    const runs = await repo.findGhostRuns({ category: 'ALGO', excludeUserId: me.id });
    expect(runs).toEqual([
      {
        matchId: ranked.id,
        problemId: problem.id,
        userId: ghost.id,
        username: 'ghost_ok',
        elo: 1040,
        solved: true,
        startedAt: ranked.startedAt,
        endedAt: ranked.endedAt,
      },
    ]);
    // "mine": me is excluded (own run) and ghost_ok has no submission there.
    expect(runs.some((r) => r.matchId === mine.id)).toBe(false);
    // Another category has no runs.
    expect(await repo.findGhostRuns({ category: 'DEBUG', excludeUserId: me.id })).toEqual([]);

    const timeline = await repo.loadRunSubmissions(ranked.id, ghost.id);
    expect(timeline).toEqual([
      expect.objectContaining({ status: 'ACCEPTED', passed: 5, total: 5 }),
    ]);
    expect(Object.keys(timeline[0])).not.toContain('code'); // no code is ever loaded for a replay
  });

  it('the Settings toggle removes a user from the pool (and adds them back)', async () => {
    const agent = request.agent(app);
    const res = await register(agent, { username: 'toggler', email: 'toggler@x.io' });
    expect(res.body.user.allowGhosts).toBe(true); // default ON
    const toggler = await prisma.user.findUnique({ where: { username: 'toggler' } });
    await playedMatch({ a: toggler, b: ghost });
    const count = async () =>
      (await repo.findGhostRuns({ category: 'ALGO', excludeUserId: me.id })).filter(
        (r) => r.userId === toggler.id,
      ).length;
    expect(await count()).toBe(1);

    const off = await agent.patch('/api/settings/preferences').send({ allowGhosts: false });
    expect(off.status).toBe(200);
    expect(off.body.user.allowGhosts).toBe(false);
    expect((await agent.get('/api/auth/me')).body.user.allowGhosts).toBe(false);
    expect(await count()).toBe(0);

    await agent.patch('/api/settings/preferences').send({ allowGhosts: true });
    expect(await count()).toBe(1);
    expect((await agent.patch('/api/settings/preferences').send({})).status).toBe(400);
  });
});

describe('ghost matches in the API', () => {
  let agent;
  let viewer;
  beforeEach(async () => {
    agent = request.agent(app);
    viewer = (await register(agent, { username: 'viewer_g', email: 'viewer_g@x.io' })).body.user;
  });

  /** A finished GHOST match of `user` against ghost_ok's replay (or a bot). */
  async function ghostMatch(user, { winnerIsGhost = false, bot = null, source } = {}) {
    return prisma.match.create({
      data: {
        mode: 'GHOST',
        status: 'FINISHED',
        endReason: winnerIsGhost ? 'SOLVED' : 'TIMEOUT',
        player1Id: user.id,
        player2Id: null,
        problemId: problem.id,
        winnerId: winnerIsGhost ? null : user.id,
        winnerIsGhost,
        durationMs: 600_000,
        testCount: 5,
        player1Elo: 1000,
        player2Elo: bot ? 1100 : 1040,
        player1EloChange: winnerIsGhost ? -7 : 9,
        ghostUserId: bot ? null : ghost.id,
        ghostSourceMatchId: source?.id ?? null,
        botId: bot,
        startedAt: new Date('2026-11-02T10:00:00Z'),
        endedAt: new Date('2026-11-02T10:05:00Z'),
      },
    });
  }

  it('history flags ghosts and bots; a ghost win is a loss; the breakdown splits players and ghosts', async () => {
    const source = await playedMatch({ a: ghost, b: shy });
    const user = await prisma.user.findUnique({ where: { id: viewer.id } });
    await ghostMatch(user, { winnerIsGhost: true, source });
    await ghostMatch(user, { bot: 'pixel' });
    await createMatch({ a: user, b: shy, problem, winner: shy, minute: 50 }); // vs a player

    const all = await agent.get('/api/users/viewer_g/matches');
    const ghosts = all.body.matches.filter((m) => m.mode === 'GHOST');
    expect(ghosts).toHaveLength(2);
    expect(ghosts.map((m) => [m.result, m.opponent])).toEqual(
      expect.arrayContaining([
        [
          'L',
          expect.objectContaining({
            username: 'ghost_ok',
            elo: 1040,
            ghost: expect.objectContaining({
              kind: 'ghost',
              replayOf: source.endedAt.toISOString(),
            }),
          }),
        ],
        [
          'W',
          {
            username: 'Pixel',
            elo: 1100,
            ghost: { kind: 'bot', id: 'pixel', name: 'Pixel', rating: 1100 },
          },
        ],
      ]),
    );
    const onlyGhosts = await agent.get('/api/users/viewer_g/matches?mode=ghost');
    expect(onlyGhosts.body.total).toBe(2);

    const breakdown = await agent.get('/api/users/viewer_g/opponents');
    expect(breakdown.body).toEqual({
      username: 'viewer_g',
      category: 'ALGO',
      vsPlayers: { wins: 0, losses: 1, draws: 0, games: 1 },
      vsGhosts: { wins: 1, losses: 1, draws: 0, games: 2 },
    });
    // The ghost's real account never sees the replay in its own history.
    const ghostHistory = await agent.get('/api/users/ghost_ok/matches');
    expect(ghostHistory.body.matches.every((m) => m.mode !== 'GHOST')).toBe(true);
    // Ghost matches count in the rated ELO history.
    const history = await agent.get('/api/users/viewer_g/elo-history');
    // Oldest first: the ranked fixture match (+16, January), then the two ghost matches (November).
    expect(history.body.points.map((p) => p.delta)).toEqual([0, 16, -7, 9]);
  });

  it('match details flag the ghost and never show code for it', async () => {
    const user = await prisma.user.findUnique({ where: { id: viewer.id } });
    const match = await ghostMatch(user, { winnerIsGhost: true });
    const details = await agent.get(`/api/matches/${match.id}`);
    expect(details.status).toBe(200);
    expect(details.body.match).toMatchObject({
      mode: 'GHOST',
      winnerId: 0,
      players: [
        { username: 'viewer_g', result: 'L' },
        {
          userId: 0,
          username: 'ghost_ok',
          result: 'W',
          ghost: { kind: 'ghost', username: 'ghost_ok' },
        },
      ],
    });
    const code = await agent.get(`/api/matches/${match.id}/code`);
    expect(code.body.players).toEqual([
      { userId: viewer.id, submission: null },
      { userId: 0, submission: null },
    ]);
    expect(JSON.stringify(details.body) + JSON.stringify(code.body)).not.toContain(
      'SECRET_GHOST_CODE',
    );
  });
});
