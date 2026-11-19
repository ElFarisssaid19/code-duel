import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  PUBLIC_USER_KEYS,
  expectNoPasswordHash,
  getTokenCookie,
  register,
  validUser,
} from './helpers.js';

describe('POST /api/auth/register', () => {
  it('creates the user, returns public fields and sets the session cookie', async () => {
    const res = await register(request(app), { email: '  Alice@Example.COM ' });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body.user).sort()).toEqual(PUBLIC_USER_KEYS);
    expect(res.body.user).toMatchObject({
      username: validUser.username,
      email: 'alice@example.com', // trimmed + lowercased
      elo: 1000,
      wins: 0,
      losses: 0,
      draws: 0,
    });
    expectNoPasswordHash(res);

    const cookie = getTokenCookie(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=604800/); // 7 days
    expect(cookie).not.toMatch(/Secure/); // secure only in production
  });

  it('stores a bcrypt hash (cost 12), never the plain password', async () => {
    await register(request(app));
    const row = await prisma.user.findUnique({ where: { username: validUser.username } });

    expect(row.passwordHash).not.toBe(validUser.password);
    expect(bcrypt.getRounds(row.passwordHash)).toBe(12);
    expect(await bcrypt.compare(validUser.password, row.passwordHash)).toBe(true);
  });

  it('returns 409 when the username is taken', async () => {
    await register(request(app));
    const res = await register(request(app), { email: 'other@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'CONFLICT',
      message: 'Username is already taken',
      details: { username: ['Username is already taken'] },
    });
    expect(getTokenCookie(res)).toBeUndefined();
  });

  it('returns 409 when the email is taken (case-insensitive)', async () => {
    await register(request(app));
    const res = await register(request(app), { username: 'bob', email: 'ALICE@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'CONFLICT',
      message: 'Email is already taken',
      details: { email: ['Email is already taken'] },
    });
  });

  it.each([
    ['username too short', { username: 'ab' }, 'username'],
    ['username too long', { username: 'a'.repeat(21) }, 'username'],
    ['username with invalid characters', { username: 'bad name!' }, 'username'],
    ['invalid email', { email: 'not-an-email' }, 'email'],
    ['password too short', { password: 'short' }, 'password'],
    ['password over 72 bytes', { password: 'é'.repeat(40) }, 'password'],
    ['missing username', { username: undefined }, 'username'],
  ])('returns 400 for %s', async (_label, overrides, field) => {
    const res = await register(request(app), overrides);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[field]).toEqual([expect.any(String)]);
    expect(await prisma.user.count()).toBe(0);
  });

  it('returns 400 with every invalid field at once', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'x', email: 'y', password: 'z' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['email', 'password', 'username']);
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"username": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the username', async () => {
    await register(request(app));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: validUser.username, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(validUser.username);
    expect(getTokenCookie(res)).toMatch(/HttpOnly/);
    expectNoPasswordHash(res);
  });

  it('logs in with the email (case-insensitive)', async () => {
    await register(request(app));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '  ALICE@example.com ', password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
    expect(getTokenCookie(res)).toBeDefined();
  });

  it('returns 401 with a generic message for a wrong password', async () => {
    await register(request(app));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: validUser.username, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
    });
    expect(getTokenCookie(res)).toBeUndefined();
  });

  it('returns the exact same 401 for an unknown user (no user enumeration)', async () => {
    await register(request(app));
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ identifier: validUser.username, password: 'wrong-password' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@example.com', password: 'wrong-password' });

    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['identifier', 'password']);
  });

  it('rate-limits to 10 attempts per 15 minutes', async () => {
    const attempt = () =>
      request(app).post('/api/auth/login').send({ identifier: 'x', password: 'y' });

    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user with a valid cookie', async () => {
    const agent = request.agent(app);
    const { body } = await register(agent);
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(body.user);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(Object.keys(res.body.user).sort()).toEqual(PUBLIC_USER_KEYS);
    expectNoPasswordHash(res);
  });

  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a tampered token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=not.a.valid-jwt');

    expect(res.status).toBe(401);
  });

  it('returns 401 when the user no longer exists', async () => {
    const agent = request.agent(app);
    await register(agent);
    await prisma.user.deleteMany();

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the cookie and ends the session', async () => {
    const agent = request.agent(app);
    await register(agent);
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    const res = await agent.post('/api/auth/logout');

    expect(res.status).toBe(204);
    const cookie = getTokenCookie(res);
    expect(cookie).toMatch(/^token=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('passwordHash never leaves the server', () => {
  it('is absent from every auth response', async () => {
    const agent = request.agent(app);
    const responses = [
      await register(agent),
      await register(request(app)), // 409
      await register(request(app), { username: '!' }), // 400
      await agent.post('/api/auth/login').send({
        identifier: validUser.email,
        password: validUser.password,
      }),
      await agent.post('/api/auth/login').send({ identifier: validUser.email, password: 'nope' }),
      await agent.get('/api/auth/me'),
      await agent.post('/api/auth/logout'),
    ];

    for (const res of responses) expectNoPasswordHash(res);
  });
});
