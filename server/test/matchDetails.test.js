import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createMatch } from './fixtures.js';
import { createProblem, expectNoHiddenData, getTokenCookie, register } from './helpers.js';

let players;
let problem;

async function login(username) {
  const agent = request.agent(app);
  const res = await register(agent, { username, email: `${username}@details.test` });
  return { agent, user: res.body.user, cookie: getTokenCookie(res) };
}

beforeEach(async () => {
  problem = await createProblem(prisma); // has sentinel hidden tests
  players = { alice: await login('alice_d'), bob: await login('bob_d'), eve: await login('eve_d') };
});

/** A match between alice and bob with a few submissions; code strings are distinctive. */
async function seedMatch(status) {
  const match = await createMatch({
    a: players.alice.user,
    b: players.bob.user,
    problem,
    winner: status === 'FINISHED' ? players.alice.user : null,
    status,
    aPassed: 5,
    bPassed: 2,
  });
  const start = match.startedAt.getTime();
  const submit = (who, language, code, secondsIn, status2, passed) =>
    prisma.submission.create({
      data: {
        matchId: match.id,
        userId: players[who].user.id,
        problemId: problem.id,
        language,
        code,
        status: status2,
        passed,
        total: 5,
        createdAt: new Date(start + secondsIn * 1000),
      },
    });
  await submit('alice', 'python', 'ALICE_FIRST_ATTEMPT', 30, 'WRONG_ANSWER', 3);
  await submit('bob', 'javascript', 'BOB_ONLY_ATTEMPT', 45, 'WRONG_ANSWER', 2);
  await submit('alice', 'javascript', 'ALICE_FINAL_CODE', 90, 'ACCEPTED', 5);
  return match;
}

const CODE_STRINGS = ['ALICE_FIRST_ATTEMPT', 'BOB_ONLY_ATTEMPT', 'ALICE_FINAL_CODE'];
const expectNoCode = (body) => {
  for (const code of CODE_STRINGS) expect(JSON.stringify(body)).not.toContain(code);
};

describe('GET /api/matches/:id', () => {
  it('returns the summary and both timelines without any code', async () => {
    const match = await seedMatch('FINISHED');
    const res = await players.eve.agent.get(`/api/matches/${match.id}`);

    expect(res.status).toBe(200);
    expect(res.body.match).toMatchObject({
      id: match.id,
      mode: 'RANKED',
      status: 'FINISHED',
      endReason: 'SOLVED',
      winnerId: players.alice.user.id,
      problem: { title: 'Add Two Values', slug: 'add-two', difficulty: 'EASY' },
      durationMs: 5 * 60_000,
      players: [
        {
          username: 'alice_d',
          eloBefore: 1000,
          eloChange: 16,
          eloAfter: 1016,
          passed: 5,
          result: 'W',
          solveTimeMs: 120_000,
        },
        { username: 'bob_d', eloChange: -16, passed: 2, result: 'L', solveTimeMs: null },
      ],
      code: { available: false, reason: 'NOT_A_PARTICIPANT' },
    });
    expect(res.body.match.timeline).toEqual([
      expect.objectContaining({
        userId: players.alice.user.id,
        offsetMs: 30_000,
        language: 'python',
        status: 'WRONG_ANSWER',
        passed: 3,
        total: 5,
      }),
      expect.objectContaining({
        userId: players.bob.user.id,
        offsetMs: 45_000,
        language: 'javascript',
        passed: 2,
      }),
      expect.objectContaining({
        userId: players.alice.user.id,
        offsetMs: 90_000,
        status: 'ACCEPTED',
        passed: 5,
      }),
    ]);
    expectNoCode(res.body);
    expectNoHiddenData(res.body);
  });

  it('tells participants the code is available once finished', async () => {
    const match = await seedMatch('FINISHED');
    const res = await players.bob.agent.get(`/api/matches/${match.id}`);
    expect(res.body.match.code).toEqual({ available: true, reason: null });
    expectNoCode(res.body);
  });

  it('returns 404 for unknown or invalid ids, 401 without a session', async () => {
    expect((await players.eve.agent.get('/api/matches/999999')).status).toBe(404);
    expect((await players.eve.agent.get('/api/matches/abc')).status).toBe(404);
    expect((await request(app).get('/api/matches/1')).status).toBe(401);
  });
});

describe('GET /api/matches/:id/code', () => {
  it("shows both players' last submissions to the participants after the match", async () => {
    const match = await seedMatch('FINISHED');
    for (const who of ['alice', 'bob']) {
      const res = await players[who].agent.get(`/api/matches/${match.id}/code`);
      expect(res.status).toBe(200);
      expect(res.body.players).toEqual([
        {
          userId: players.alice.user.id,
          submission: expect.objectContaining({
            language: 'javascript',
            code: 'ALICE_FINAL_CODE',
            status: 'ACCEPTED',
            passed: 5,
            total: 5,
          }),
        },
        {
          userId: players.bob.user.id,
          submission: expect.objectContaining({ language: 'javascript', code: 'BOB_ONLY_ATTEMPT' }),
        },
      ]);
      expect(JSON.stringify(res.body)).not.toContain('ALICE_FIRST_ATTEMPT'); // only the last one
      expectNoHiddenData(res.body);
    }
  });

  it('is hidden from everyone else (403)', async () => {
    const match = await seedMatch('FINISHED');
    const res = await players.eve.agent.get(`/api/matches/${match.id}/code`);
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({
      code: 'NOT_A_PARTICIPANT',
      message: 'Only the two players can see the code of this match.',
    });
    expectNoCode(res.body);
  });

  it.each(['ACTIVE', 'COUNTDOWN', 'WAITING', 'CANCELLED'])(
    'is hidden from participants while the match is %s (403)',
    async (status) => {
      const match = await seedMatch(status);
      for (const who of ['alice', 'bob']) {
        const res = await players[who].agent.get(`/api/matches/${match.id}/code`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('MATCH_NOT_FINISHED');
        expectNoCode(res.body);
      }
      const summary = await players.alice.agent.get(`/api/matches/${match.id}`);
      expect(summary.body.match.code).toEqual({ available: false, reason: 'MATCH_NOT_FINISHED' });
      expectNoCode(summary.body);
    },
  );

  it('returns a null submission for a player who never submitted', async () => {
    const match = await createMatch({
      a: players.alice.user,
      b: players.bob.user,
      problem,
      winner: players.bob.user,
      status: 'FINISHED',
    });
    const res = await players.alice.agent.get(`/api/matches/${match.id}/code`);
    expect(res.body.players.map((p) => p.submission)).toEqual([null, null]);
  });
});
