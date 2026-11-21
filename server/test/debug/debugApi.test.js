/**
 * DEBUG over the API and real sockets (real go-judge): problem list and brief, practice with
 * lines changed, and a ranked DEBUG duel where only DEBUG ratings change.
 */
import { createServer } from 'node:http';
import { io as connect } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import debugProblems from '../../prisma/seed/debug/index.js';
import { debugProblemData } from '../../prisma/seed/debugVerify.js';
import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { initSocket } from '../../src/socket/index.js';
import { ratingOf } from '../fixtures.js';
import { getTokenCookie, register } from '../helpers.js';

const passingGrades = debugProblems.find((p) => p.slug === 'debug-passing-grades');

async function createDebugProblem(p) {
  return prisma.problem.create({
    data: {
      slug: p.slug,
      ...debugProblemData(p),
      testCases: {
        create: p.tests.map((t, order) => ({
          order,
          input: t.input,
          expectedOutput: t.expected,
          isHidden: Boolean(t.hidden),
        })),
      },
    },
  });
}

let agent;
beforeEach(async () => {
  agent = request.agent(app);
  await register(agent);
  await createDebugProblem(passingGrades);
});

describe('DEBUG problems and practice', () => {
  it('lists DEBUG problems with their bug count; the brief starts with the buggy code', async () => {
    const list = await agent.get('/api/problems?category=DEBUG');
    expect(list.body.problems).toEqual([
      {
        id: expect.any(Number),
        slug: 'debug-passing-grades',
        title: 'Passing Grades',
        difficulty: 'EASY',
        solved: false,
        bugCount: 1,
      },
    ]);
    expect((await agent.get('/api/problems')).body.problems).toEqual([]); // ALGO list unchanged
    const brief = await agent.get('/api/problems/debug-passing-grades');
    expect(brief.body.problem).toMatchObject({
      category: 'DEBUG',
      bugCount: 1,
      starterCode: passingGrades.buggy,
    });
    expect(brief.body.problem.samples).toHaveLength(2);
    expect(JSON.stringify(brief.body)).not.toContain('score >= passMark'); // never the fix
  });

  it('practice: run and submit report lines changed; the fix is accepted with 1 line changed', async () => {
    const run = await agent
      .post('/api/practice/debug-passing-grades/run')
      .send({ language: 'javascript', code: passingGrades.buggy.javascript });
    expect(run.body.result.status).toBe('WRONG_ANSWER');
    expect(run.body.linesChanged).toBe(0);
    await new Promise((r) => setTimeout(r, 3100)); // rate limit
    const submit = await agent
      .post('/api/practice/debug-passing-grades/submit')
      .send({ language: 'python', code: passingGrades.fixed.python });
    expect(submit.body.result.status).toBe('ACCEPTED');
    expect(submit.body.linesChanged).toBe(1);
    const row = await prisma.submission.findFirst({ where: { status: 'ACCEPTED' } });
    expect(row.linesChanged).toBe(1);
  }, 20_000);
});

describe('ranked DEBUG duel (real sockets and judge)', () => {
  let httpServer;
  let io;
  let url;
  beforeAll(async () => {
    httpServer = createServer(app);
    io = initSocket(httpServer, { matchConfig: { countdownMs: 300 } });
    await new Promise((resolve) => httpServer.listen(0, resolve));
    url = `http://localhost:${httpServer.address().port}`;
  });
  afterAll(async () => {
    io.matchManager.shutdown();
    await io.close();
  });

  async function player(username) {
    const res = await register(request(app), { username, email: `${username}@dbg.io` });
    const socket = connect(url, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { cookie: getTokenCookie(res).split(';')[0] },
    });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    const next = (event) => new Promise((resolve) => socket.once(event, resolve));
    const ack = async (event, payload) => {
      const r = await socket.timeout(15_000).emitWithAck(event, payload);
      if (!r.ok) throw new Error(`${event}: ${JSON.stringify(r.error)}`);
      return r.data;
    };
    return { id: res.body.user.id, socket, next, ack };
  }

  it('lines changed are live, the first to pass every test wins, only DEBUG ratings change', async () => {
    const a = await player('dbg_alice');
    const b = await player('dbg_bob');
    const found = a.next('match:found');
    await a.ack('queue:join', { category: 'DEBUG' });
    await b.ack('queue:join', { category: 'DEBUG' });
    const { matchId } = await found;
    const started = a.next('match:start');
    await Promise.all([a.ack('match:rejoin', { matchId }), b.ack('match:rejoin', { matchId })]);
    const start = await started;
    expect(start.problem).toMatchObject({
      category: 'DEBUG',
      bugCount: 1,
      slug: 'debug-passing-grades',
    });
    expect(start.endsAt - start.serverNow).toBeGreaterThan(5.9 * 60_000); // EASY: 6 minutes
    expect(start.endsAt - start.serverNow).toBeLessThanOrEqual(6 * 60_000);

    const progress = a.next('opponent:progress');
    const partial = await b.ack('match:submit', {
      language: 'javascript',
      code: passingGrades.buggy.javascript.replace(
        'let count = 0;',
        'let count = 0; // looked here',
      ),
    });
    expect(partial.linesChanged).toBe(1);
    expect(await progress).toMatchObject({ userId: b.id, linesChanged: 1, total: 8 });

    const ended = b.next('match:end');
    const win = await a.ack('match:submit', {
      language: 'javascript',
      code: passingGrades.fixed.javascript,
    });
    expect(win.result.status).toBe('ACCEPTED');
    expect(await ended).toMatchObject({ winnerId: a.id, reason: 'SOLVED', category: 'DEBUG' });

    expect(await ratingOf(a.id, 'DEBUG')).toMatchObject({ elo: 1016, wins: 1 });
    expect(await ratingOf(b.id, 'DEBUG')).toMatchObject({ elo: 984, losses: 1 });
    for (const id of [a.id, b.id]) {
      expect(await ratingOf(id, 'ALGO')).toMatchObject({ elo: 1000, wins: 0, losses: 0 });
      expect(await ratingOf(id, 'FRONTEND')).toMatchObject({ elo: 1000, wins: 0, losses: 0 });
    }
    expect(await prisma.match.findUnique({ where: { id: matchId } })).toMatchObject({
      category: 'DEBUG',
      durationMs: 6 * 60_000,
      player1Lines: expect.any(Number),
    });
    a.socket.disconnect();
    b.socket.disconnect();
  }, 30_000);
});
