/**
 * The one-time ghost replay notice: existing users see it until they dismiss it; the dismissal is
 * stored on the account (every device); new users saw it on the register page.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { register, validUser } from './helpers.js';

const DISMISS = '/api/settings/ghost-notice/dismiss';

/** An "existing" user from before the notice: registered, then reset to not-dismissed. */
async function existingUser() {
  const agent = request.agent(app);
  await register(agent);
  await prisma.user.update({
    where: { username: validUser.username },
    data: { ghostNoticeDismissedAt: null },
  });
  return agent;
}

const login = async () => {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ identifier: validUser.username, password: validUser.password });
  expect(res.status).toBe(200);
  return { agent, user: res.body.user };
};

describe('ghost replay notice', () => {
  let agent;
  beforeEach(async () => {
    agent = await existingUser();
  });

  it('existing users have not dismissed it; dismissing is stored on the account', async () => {
    expect((await agent.get('/api/auth/me')).body.user.ghostNoticeDismissed).toBe(false);

    const res = await agent.post(DISMISS);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.user).toMatchObject({
      username: validUser.username,
      ghostNoticeDismissed: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|ghostNoticeDismissedAt/);

    // Another device (a fresh login) doesn't see it again.
    const other = await login();
    expect(other.user.ghostNoticeDismissed).toBe(true);
    expect((await other.agent.get('/api/auth/session')).body.user.ghostNoticeDismissed).toBe(true);
  });

  it('is idempotent and keeps the first dismissal time', async () => {
    await agent.post(DISMISS);
    const first = await prisma.user.findUnique({ where: { username: validUser.username } });
    await new Promise((r) => setTimeout(r, 20));
    const again = await agent.post(DISMISS);
    expect(again.status).toBe(200);
    expect(again.body.user.ghostNoticeDismissed).toBe(true);
    const second = await prisma.user.findUnique({ where: { username: validUser.username } });
    expect(second.ghostNoticeDismissedAt).toEqual(first.ghostNoticeDismissedAt);
  });

  it('requires a session', async () => {
    expect((await request(app).post(DISMISS)).status).toBe(401);
  });

  it('only changes the caller', async () => {
    const other = request.agent(app);
    await register(other, { username: 'other_user', email: 'other@x.io' });
    await prisma.user.update({
      where: { username: 'other_user' },
      data: { ghostNoticeDismissedAt: null },
    });
    await agent.post(DISMISS);
    expect((await other.get('/api/auth/me')).body.user.ghostNoticeDismissed).toBe(false);
  });

  it('new users saw the notice on the register page: no banner for them', async () => {
    const res = await register(request(app), { username: 'newcomer', email: 'newcomer@x.io' });
    expect(res.body.user.ghostNoticeDismissed).toBe(true);
  });
});
