import { expect } from 'vitest';

export const validUser = Object.freeze({
  username: 'alice_01',
  email: 'alice@example.com',
  password: 'correct-horse-battery',
});

export const PUBLIC_USER_KEYS = [
  'createdAt',
  'draws',
  'elo',
  'email',
  'id',
  'losses',
  'username',
  'wins',
].sort();

/** Registers a user through the API (with a supertest agent or request(app)). */
export function register(client, overrides = {}) {
  return client.post('/api/auth/register').send({ ...validUser, ...overrides });
}

/** Returns the `token` Set-Cookie header of a response, if any. */
export function getTokenCookie(res) {
  return (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('token='));
}

/** Asserts a response body never leaks the password hash, however deeply nested. */
export function expectNoPasswordHash(res) {
  const raw = JSON.stringify(res.body ?? {});
  expect(raw).not.toMatch(/passwordHash/i);
  expect(raw).not.toMatch(/\$2[aby]\$\d{2}\$/); // bcrypt hash format
}
