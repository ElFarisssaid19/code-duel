import { createServer } from 'node:http';
import { SignJWT } from 'jose';
import { io as connect } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { getPublicStats, resetPublicStatsCache } from '../src/services/stats.service.js';
import { initSocket } from '../src/socket/index.js';
import { createMatch, createProblemRow, createUser } from './fixtures.js';
import { getTokenCookie, register, validUser } from './helpers.js';

const NEW_PASSWORD = 'brand-new-password-42';
const cookieOf = (res) => getTokenCookie(res).split(';')[0];

/** Two independent sessions (two "devices") of the same user. */
async function twoSessions() {
  const first = request.agent(app);
  const reg = await register(first);
  const second = request.agent(app);
  const login = await second
    .post('/api/auth/login')
    .send({ identifier: validUser.username, password: validUser.password });
  expect(login.status).toBe(200);
  return { first, second, firstCookie: cookieOf(reg), secondCookie: cookieOf(login) };
}

describe('GET /api/stats/public', () => {
  it('needs no auth and returns players, finished matches and problems by difficulty', async () => {
    resetPublicStatsCache();
    const [a, b] = await Promise.all([createUser('st_a'), createUser('st_b')]);
    const easy = await createProblemRow('s1', 'EASY');
    await createProblemRow('s2', 'HARD');
    await createProblemRow('s3', 'HARD');
    await createMatch({ a, b, problem: easy, winner: a });
    await createMatch({ a, b, problem: easy, winner: null, status: 'CANCELLED' });

    const res = await request(app).get('/api/stats/public');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    expect(res.body).toEqual({
      players: 2,
      finishedMatches: 1,
      problems: { EASY: 1, MEDIUM: 0, HARD: 2, total: 3 },
      generatedAt: expect.any(String),
    });
  });

  it('is cached in memory for 60 seconds', async () => {
    resetPublicStatsCache();
    const t0 = Date.UTC(2026, 10, 20, 12, 0, 0);
    expect((await getPublicStats(t0)).players).toBe(0);
    await createUser('late_comer');
    expect((await getPublicStats(t0 + 59_000)).players).toBe(0); // still cached
    expect((await getPublicStats(t0 + 60_001)).players).toBe(1); // refreshed
    resetPublicStatsCache();
  });
});

describe('POST /api/settings/password', () => {
  it('requires the current password and validates the new one like register', async () => {
    const agent = request.agent(app);
    await register(agent);

    const wrong = await agent
      .post('/api/settings/password')
      .send({ currentPassword: 'nope', newPassword: NEW_PASSWORD });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toEqual({
      code: 'INVALID_CURRENT_PASSWORD',
      message: 'Current password is incorrect',
      details: { currentPassword: ['Current password is incorrect'] },
    });

    const short = await agent
      .post('/api/settings/password')
      .send({ currentPassword: validUser.password, newPassword: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.error.details.newPassword).toEqual([
      'Password must be at least 8 characters',
    ]);

    const same = await agent
      .post('/api/settings/password')
      .send({ currentPassword: validUser.password, newPassword: validUser.password });
    expect(same.body.error.details.newPassword).toEqual([
      'The new password must be different from the current one',
    ]);

    expect((await request(app).post('/api/settings/password').send({})).status).toBe(401);
  });

  it('changes the password, keeps this session (fresh cookie) and revokes the other ones', async () => {
    const { first, second, secondCookie } = await twoSessions();

    const res = await first
      .post('/api/settings/password')
      .send({ currentPassword: validUser.password, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(validUser.username);
    expect(getTokenCookie(res)).toMatch(/HttpOnly/);

    expect((await first.get('/api/auth/me')).status).toBe(200); // fresh cookie
    expect((await second.get('/api/auth/me')).status).toBe(401); // old token rejected
    expect(
      (await request(app).get('/api/auth/me').set('Cookie', secondCookie)).body.error.code,
    ).toBe('UNAUTHORIZED');

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: validUser.username, password: validUser.password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: validUser.username, password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
    expect(
      (await prisma.user.findUnique({ where: { username: validUser.username } })).tokenVersion,
    ).toBe(1);
  });

  it('is rate-limited (5 attempts / 15 min per user)', async () => {
    const agent = request.agent(app);
    await register(agent);
    for (let i = 0; i < 5; i++) {
      expect(
        (
          await agent
            .post('/api/settings/password')
            .send({ currentPassword: 'wrong', newPassword: NEW_PASSWORD })
        ).status,
      ).toBe(400);
    }
    const blocked = await agent
      .post('/api/settings/password')
      .send({ currentPassword: validUser.password, newPassword: NEW_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('POST /api/settings/logout-all and logout', () => {
  it('"log out of all devices" revokes every session, including this one', async () => {
    const { first, second } = await twoSessions();
    const res = await first.post('/api/settings/logout-all');
    expect(res.status).toBe(204);
    expect(getTokenCookie(res)).toMatch(/^token=;/);
    expect((await first.get('/api/auth/me')).status).toBe(401);
    expect((await second.get('/api/auth/me')).status).toBe(401);
    // Logging in again works and issues a token with the new version.
    const login = request.agent(app);
    await login
      .post('/api/auth/login')
      .send({ identifier: validUser.username, password: validUser.password });
    expect((await login.get('/api/auth/me')).status).toBe(200);
  });

  it('normal logout only ends this session', async () => {
    const { first, second } = await twoSessions();
    expect((await first.post('/api/auth/logout')).status).toBe(204);
    expect((await first.get('/api/auth/me')).status).toBe(401);
    expect((await second.get('/api/auth/me')).status).toBe(200);
  });

  it('accepts tokens issued before versioning existed while the version is 0', async () => {
    const agent = request.agent(app);
    const { body } = await register(agent);
    const legacy = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(body.user.id))
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(env.JWT_SECRET));
    expect((await request(app).get('/api/auth/me').set('Cookie', `token=${legacy}`)).status).toBe(
      200,
    );
    await agent.post('/api/settings/logout-all');
    expect((await request(app).get('/api/auth/me').set('Cookie', `token=${legacy}`)).status).toBe(
      401,
    );
  });
});

describe('GET /api/auth/session', () => {
  it('answers 200 with the user, or null for guests and revoked tokens (never 401)', async () => {
    expect(await request(app).get('/api/auth/session')).toMatchObject({
      status: 200,
      body: { user: null },
    });
    const { first, second } = await twoSessions();
    const res = await first.get('/api/auth/session');
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(validUser.username);
    expect(res.headers['cache-control']).toBe('no-store');
    await first.post('/api/settings/logout-all');
    expect((await second.get('/api/auth/session')).body).toEqual({ user: null });
  });
});

describe('PATCH /api/settings/preferences', () => {
  it('saves the default language, returned by /me', async () => {
    const agent = request.agent(app);
    const { body } = await register(agent);
    expect(body.user.preferredLanguage).toBe('javascript');

    const res = await agent
      .patch('/api/settings/preferences')
      .send({ preferredLanguage: 'python' });
    expect(res.status).toBe(200);
    expect(res.body.user.preferredLanguage).toBe('python');
    expect((await agent.get('/api/auth/me')).body.user.preferredLanguage).toBe('python');

    const bad = await agent.patch('/api/settings/preferences').send({ preferredLanguage: 'ruby' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.preferredLanguage).toEqual([
      'Language must be one of: javascript, python',
    ]);
  });
});

describe('socket revocation', () => {
  let httpServer;
  let io;
  let url;
  beforeAll(async () => {
    httpServer = createServer(app);
    io = initSocket(httpServer);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    url = `http://localhost:${httpServer.address().port}`;
  });
  afterAll(async () => {
    io.matchManager.shutdown();
    await io.close();
  });

  const open = (cookie) =>
    connect(url, { transports: ['websocket'], reconnection: false, extraHeaders: { cookie } });
  const connected = (socket) =>
    new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });

  it('disconnects sockets of other sessions on password change, and rejects the old token afterwards', async () => {
    const { first, secondCookie } = await twoSessions();
    const socket = open(secondCookie);
    await connected(socket);

    const revoked = new Promise((resolve) => socket.once('session:revoked', resolve));
    const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));
    await first
      .post('/api/settings/password')
      .send({ currentPassword: validUser.password, newPassword: NEW_PASSWORD });

    expect(await revoked).toEqual({ reason: 'Your session was ended on another device.' });
    expect(await disconnected).toBe('io server disconnect');

    // Reconnecting with the old token is refused at the handshake.
    const again = open(secondCookie);
    const error = await connected(again).catch((err) => err);
    expect(error.data).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized: invalid or expired session',
    });
    again.disconnect();
  });

  it('"log out of all devices" disconnects every socket of the user', async () => {
    const { first, firstCookie, secondCookie } = await twoSessions();
    const sockets = [open(firstCookie), open(secondCookie)];
    await Promise.all(sockets.map(connected));
    const gone = sockets.map((s) => new Promise((resolve) => s.once('disconnect', resolve)));
    await first.post('/api/settings/logout-all');
    expect(await Promise.all(gone)).toEqual(['io server disconnect', 'io server disconnect']);
  });

  it('leaves other users connected', async () => {
    const other = request.agent(app);
    const res = await register(other, { username: 'other_user', email: 'other@example.com' });
    const socket = open(cookieOf(res));
    await connected(socket);
    const { first } = await twoSessions();
    await first.post('/api/settings/logout-all');
    await new Promise((r) => setTimeout(r, 200));
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });
});
