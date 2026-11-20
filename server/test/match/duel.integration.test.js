/**
 * Duels end to end: real HTTP server + Socket.io + MatchManager + MySQL + go-judge, with two
 * real socket.io-client connections (two users). Countdown/grace are shortened via config.
 */
import { createServer } from 'node:http';
import { io as connect } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { initSocket } from '../../src/socket/index.js';
import { ratingOf } from '../fixtures.js';
import { createFrontendProblem, FRONTEND } from '../frontendFixtures.js';
import {
  createProblem,
  getTokenCookie,
  HIDDEN_SENTINELS,
  register,
  SOLUTIONS,
} from '../helpers.js';

let httpServer;
let io;
let url;
let clients = [];
const everything = []; // every event payload and ack received by any client, for the leak scan

beforeAll(async () => {
  httpServer = createServer(app);
  io = initSocket(httpServer, { matchConfig: { countdownMs: 300, disconnectGraceMs: 1500 } });
  await new Promise((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${httpServer.address().port}`;
});

afterEach(() => {
  for (const c of clients) c.socket.disconnect();
  clients = [];
});

afterAll(async () => {
  io.matchManager.shutdown();
  await io.close();
});

let users;
beforeEach(async () => {
  await createProblem(prisma); // EASY "add" problem with sentinel hidden tests
  users = {};
  for (const [name, email] of [
    ['alice_duel', 'alice@duel.io'],
    ['bob_duel', 'bob@duel.io'],
  ]) {
    const res = await register(request(app), { username: name, email });
    users[name] = { id: res.body.user.id, cookie: getTokenCookie(res).split(';')[0] };
  }
});

/** A connected client that records every event and can wait for one. */
async function client(name) {
  const socket = connect(url, {
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: { cookie: users[name].cookie },
  });
  const events = [];
  const waiters = [];
  socket.onAny((event, payload) => {
    events.push({ event, payload });
    everything.push({ event, payload });
    for (const w of [...waiters]) {
      if (w.event === event && w.predicate(payload)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(payload);
      }
    }
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  const c = {
    name,
    id: users[name].id,
    socket,
    events,
    /** Resolves with the next (or an already received) matching event. */
    waitFor(event, predicate = () => true, timeoutMs = 10_000) {
      const seen = events.find((e) => e.event === event && predicate(e.payload) && !e.consumed);
      if (seen) {
        seen.consumed = true;
        return Promise.resolve(seen.payload);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`${name}: timed out waiting for ${event}`)),
          timeoutMs,
        );
        waiters.push({ event, predicate, resolve: (p) => (clearTimeout(timer), resolve(p)) });
      });
    },
    async emit(event, payload) {
      const res = await socket.timeout(15_000).emitWithAck(event, payload);
      everything.push({ ack: event, res });
      return res;
    },
    async ok(event, payload) {
      const res = await c.emit(event, payload);
      if (!res.ok) throw new Error(`${event} failed: ${JSON.stringify(res.error)}`);
      return res.data;
    },
  };
  clients.push(c);
  return c;
}

/** Both clients join the match and wait for match:start. */
async function playMatch(a, b, matchId) {
  await Promise.all([a.ok('match:rejoin', { matchId }), b.ok('match:rejoin', { matchId })]);
  await a.waitFor('match:countdown');
  const [startA] = await Promise.all([a.waitFor('match:start'), b.waitFor('match:start')]);
  return startA;
}

describe('ranked duel (real server, sockets, DB and go-judge)', () => {
  it('matches two players, one solves, ELO is updated in the database', async () => {
    const a = await client('alice_duel');
    const b = await client('bob_duel');

    expect(await a.ok('queue:join')).toMatchObject({ status: 'searching', window: 100 });
    await b.ok('queue:join');
    const { matchId } = await a.waitFor('match:found');
    expect(await b.waitFor('match:found')).toEqual({ matchId, mode: 'RANKED' });

    const start = await playMatch(a, b, matchId);
    expect(start).toMatchObject({
      matchId,
      opponent: { username: 'bob_duel', elo: 1000 },
      problem: { slug: 'add-two' },
    });
    expect(start.problem.samples).toHaveLength(2);
    expect(start.problem.tests).toBeUndefined();

    // Bob submits a wrong answer; Alice sees his progress.
    const wrong = await b.ok('match:submit', { language: 'python', code: SOLUTIONS.python.wrong });
    expect(wrong.result).toMatchObject({ mode: 'submit', status: 'WRONG_ANSWER', total: 5 });
    expect(await a.waitFor('opponent:progress')).toMatchObject({
      userId: b.id,
      attempts: 1,
      total: 5,
    });

    // Alice runs (samples only), then solves.
    const run = await a.ok('match:run', {
      language: 'javascript',
      code: SOLUTIONS.javascript.correct,
    });
    expect(run.result).toMatchObject({ mode: 'run', status: 'ACCEPTED', passed: 2, total: 2 });
    await new Promise((r) => setTimeout(r, 3100)); // run/submit cooldown
    const solved = await a.ok('match:submit', {
      language: 'javascript',
      code: SOLUTIONS.javascript.correct,
    });
    expect(solved.result).toMatchObject({ status: 'ACCEPTED', passed: 5, total: 5 });

    const [endA, endB] = await Promise.all([a.waitFor('match:end'), b.waitFor('match:end')]);
    expect(endA).toEqual(endB);
    expect(endA).toMatchObject({
      winnerId: a.id,
      reason: 'SOLVED',
      eloChanges: {
        [a.id]: { before: 1000, after: 1016, delta: 16 },
        [b.id]: { before: 1000, after: 984, delta: -16 },
      },
    });

    const [alice, bob] = await Promise.all([a.id, b.id].map((id) => ratingOf(id)));
    expect(alice).toMatchObject({ elo: 1016, wins: 1, losses: 0 });
    expect(bob).toMatchObject({ elo: 984, wins: 0, losses: 1 });
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { submissions: true },
    });
    expect(match).toMatchObject({
      mode: 'RANKED',
      status: 'FINISHED',
      endReason: 'SOLVED',
      winnerId: a.id,
      player1Passed: 5,
    });
    expect(match.submissions).toHaveLength(2); // runs aren't submissions
    expect(match.submissions.every((s) => s.matchId === matchId)).toBe(true);
  });

  it('restores the match after a disconnect, and a player offline too long loses', async () => {
    let a = await client('alice_duel');
    const b = await client('bob_duel');
    await a.ok('queue:join');
    await b.ok('queue:join');
    const { matchId } = await a.waitFor('match:found');
    await playMatch(a, b, matchId);
    await a.ok('match:submit', {
      language: 'javascript',
      code: 'function add(a, b) { return a + b + (a === 1 ? 0 : 1); }',
    });

    // Alice drops; Bob is told; Alice comes back within the grace period.
    a.socket.disconnect();
    expect(await b.waitFor('opponent:connection', (p) => !p.connected)).toMatchObject({
      connected: false,
      graceEndsAt: expect.any(Number),
    });
    a = await client('alice_duel');
    const state = await a.ok('match:rejoin', { matchId });
    expect(state).toMatchObject({
      status: 'ACTIVE',
      me: { passed: 1, attempts: 1 },
      opponent: { username: 'bob_duel' },
    });
    expect(state.remainingMs).toBeGreaterThan(9 * 60_000);
    expect(state.problem.samples).toHaveLength(2);
    expect(await b.waitFor('opponent:connection', (p) => p.connected)).toEqual({ connected: true });

    // Now Bob drops for longer than the (shortened) grace period.
    b.socket.disconnect();
    const end = await a.waitFor('match:end', () => true, 5000);
    expect(end).toMatchObject({ winnerId: a.id, reason: 'DISCONNECT' });
  });
});

describe('private room (real server)', () => {
  it('room code → match without ELO change → rematch', async () => {
    const a = await client('alice_duel');
    const b = await client('bob_duel');

    const room = await a.ok('room:create', { difficulty: 'EASY' });
    expect(room).toMatchObject({
      status: 'open',
      difficulty: 'EASY',
      players: [{ username: 'alice_duel' }],
    });
    expect((await b.emit('room:join', { code: 'ZZZZZZ' })).error.code).toBe('ROOM_NOT_FOUND');
    expect((await a.emit('room:join', { code: room.code })).error.code).toBe(
      'CANNOT_PLAY_YOURSELF',
    );
    expect((await b.emit('room:join', { code: 'bad' })).error.code).toBe('VALIDATION_ERROR');

    await b.ok('room:join', { code: room.code.toLowerCase() });
    const { matchId } = await a.waitFor('match:found');
    expect(await b.waitFor('match:found')).toEqual({ matchId, mode: 'PRIVATE' });
    await playMatch(a, b, matchId);

    await b.ok('match:submit', { language: 'python', code: SOLUTIONS.python.correct });
    const end = await a.waitFor('match:end');
    expect(end).toMatchObject({
      mode: 'PRIVATE',
      winnerId: b.id,
      reason: 'SOLVED',
      eloChanges: null,
    });
    const players = await Promise.all([a.id, b.id].map((id) => ratingOf(id)));
    expect(players.map((u) => [u.elo, u.wins, u.losses])).toEqual([
      [1000, 0, 0],
      [1000, 0, 0],
    ]);

    // Rematch: both must accept.
    expect(await a.ok('rematch:request')).toMatchObject({ status: 'pending', requestedBy: [a.id] });
    expect(await b.waitFor('rematch:update')).toMatchObject({ status: 'pending' });
    await b.ok('rematch:request', { matchId });
    const next = await a.waitFor('match:found', (p) => p.matchId !== matchId);
    expect(next.mode).toBe('PRIVATE');
    await playMatch(a, b, next.matchId);
    await a.ok('match:forfeit');
    expect(await b.waitFor('match:end', (p) => p.matchId === next.matchId)).toMatchObject({
      winnerId: b.id,
      reason: 'FORFEIT',
    });
  });
});

describe('FRONTEND ranked duel (real server, sockets, DB and renderer)', () => {
  it('scores live, the first to reach the threshold wins, only FRONTEND ratings change', async () => {
    await createFrontendProblem(prisma, 'css-traffic-light');
    const a = await client('alice_duel');
    const b = await client('bob_duel');
    expect(await a.ok('queue:join', { category: 'FRONTEND', track: 'CSS' })).toMatchObject({
      status: 'searching',
      category: 'FRONTEND',
      track: 'CSS',
    });
    await b.ok('queue:join', { category: 'FRONTEND' }); // any track
    const { matchId } = await a.waitFor('match:found');
    const start = await playMatch(a, b, matchId);
    expect(start.problem).toMatchObject({
      category: 'FRONTEND',
      track: 'CSS',
      slug: 'css-traffic-light',
      targetImageUrl: '/api/problems/css-traffic-light/target.png',
    });

    const partial = await b.ok('match:submit', {
      css: '/* BOB_SECRET_CSS */ body { margin: 0; height: 300px; background: #cbd5e1; }', // background only
    });
    expect(partial.result.solved).toBe(false);
    expect(partial.result.score).toBeGreaterThan(0);
    const progress = await a.waitFor('opponent:progress');
    expect(progress).toEqual({
      userId: b.id,
      passed: 0,
      total: 1,
      attempts: 1,
      score: partial.result.score,
      threshold: 99.5,
    });
    expect(JSON.stringify(a.events)).not.toContain('BOB_SECRET_CSS'); // never the opponent's code

    const win = await a.ok('match:submit', { css: FRONTEND['css-traffic-light'].reference.css });
    expect(win.result).toMatchObject({ score: 100, solved: true });
    const end = await b.waitFor('match:end');
    expect(end).toMatchObject({ winnerId: a.id, reason: 'SOLVED', category: 'FRONTEND' });

    expect(await ratingOf(a.id, 'FRONTEND')).toMatchObject({ elo: 1016, wins: 1, bestElo: 1016 });
    expect(await ratingOf(b.id, 'FRONTEND')).toMatchObject({ elo: 984, losses: 1, bestElo: 1000 });
    for (const id of [a.id, b.id]) {
      expect(await ratingOf(id, 'ALGO')).toMatchObject({ elo: 1000, wins: 0, losses: 0 });
    }
    const row = await prisma.match.findUnique({ where: { id: matchId } });
    expect(row).toMatchObject({ category: 'FRONTEND', track: 'CSS', testCount: 1 });
    expect(Number(row.player1Score) + Number(row.player2Score)).toBe(100 + partial.result.score);
  });

  it('validates the category options', async () => {
    const a = await client('alice_duel');
    expect((await a.emit('queue:join', { category: 'ALGO', track: 'CSS' })).error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'A track can only be chosen for FRONTEND',
    });
    expect((await a.emit('queue:join', { category: 'WEB' })).error.code).toBe('VALIDATION_ERROR');
    expect((await a.emit('queue:join', { category: 'FRONTEND' })).error).toMatchObject({
      code: 'NO_PROBLEMS',
    });
  });
});

describe('validation and rules over sockets', () => {
  it('rejects invalid payloads and a second activity with { code, message }', async () => {
    const a = await client('alice_duel');
    expect(await a.emit('room:create', { difficulty: 'IMPOSSIBLE' })).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Difficulty must be EASY, MEDIUM, HARD or ANY' },
    });
    expect((await a.emit('match:submit', { language: 'ruby', code: 'x' })).error.code).toBe(
      'VALIDATION_ERROR',
    );
    await a.ok('queue:join');
    expect((await a.emit('room:create', { difficulty: 'ANY' })).error).toEqual({
      code: 'ALREADY_BUSY',
      message: 'You are already searching for a ranked match.',
    });
    expect(await a.ok('state:get')).toMatchObject({ type: 'queue' });
    await a.ok('queue:leave');
    expect(await a.ok('state:get')).toEqual({ type: 'idle' });
  });
});

describe('hidden test data', () => {
  it('never appears in any event or acknowledgement, even with code that dumps its inputs', async () => {
    const a = await client('alice_duel');
    const b = await client('bob_duel');
    await a.ok('queue:join');
    await b.ok('queue:join');
    const { matchId } = await a.waitFor('match:found');
    await playMatch(a, b, matchId);

    // Prints stdin, every list in memory, and returns/raises them.
    const leakyPython = `import gc, sys
def add(a, b):
    print("stdin:", sys.stdin.read())
    dump = [o for o in gc.get_objects() if isinstance(o, list) and o and all(isinstance(x, list) for x in o)]
    print("memory:", dump)
    if a == 10:
        raise ValueError("memory dump: " + repr(dump))
    return dump
`;
    const leak = await b.ok('match:submit', { language: 'python', code: leakyPython });
    expect(leak.result.tests[0].logs).toContain('memory:'); // the dump ran…
    expect(leak.result.tests[0].logs).toContain('[1, 2]'); // …and found the sample inputs
    await a.ok('match:submit', { language: 'javascript', code: SOLUTIONS.javascript.leaky });
    await a.waitFor('opponent:progress');
    await a.ok('match:forfeit');
    await b.waitFor('match:end');

    const raw = JSON.stringify(everything);
    expect(everything.length).toBeGreaterThan(30);
    for (const value of Object.values(HIDDEN_SENTINELS)) expect(raw).not.toContain(String(value));
    expect(raw).not.toContain('zq-hidden');
  });
});
