/**
 * Share links and cards (real renderer): participants only, finished matches only, unguessable
 * ids, revoke → 404, public page with absolute Open Graph URLs, both PNG formats, escaping.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';
import { buildCard } from '../src/services/share/cardTemplate.js';
import { buildSharePage } from '../src/services/share/page.js';
import { SHARE_ID_PATTERN } from '../src/services/share/index.js';
import { createMatch } from './fixtures.js';
import { createProblem, getTokenCookie, register } from './helpers.js';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
let players;
let problem;

async function login(username) {
  const agent = request.agent(app);
  const res = await register(agent, { username, email: `${username}@share.test` });
  return { agent, user: res.body.user, cookie: getTokenCookie(res) };
}

/** [width, height] from a PNG's IHDR chunk. */
function pngSize(buffer) {
  expect(buffer.subarray(1, 4).toString()).toBe('PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

beforeEach(async () => {
  problem = await createProblem(prisma); // has hidden-test sentinels
  players = { alice: await login('alice_s'), bob: await login('bob_s'), eve: await login('eve_s') };
});

const finishedMatch = (status = 'FINISHED') =>
  createMatch({
    a: players.alice.user,
    b: players.bob.user,
    problem,
    winner: status === 'FINISHED' ? players.alice.user : null,
    status,
    aPassed: 5,
    bPassed: 2,
  });

describe('POST /api/matches/:id/share', () => {
  it('participants only, finished matches only', async () => {
    const live = await finishedMatch('ACTIVE');
    const done = await finishedMatch();
    expect((await players.eve.agent.post(`/api/matches/${done.id}/share`)).status).toBe(403);
    const notFinished = await players.alice.agent.post(`/api/matches/${live.id}/share`);
    expect(notFinished.status).toBe(403);
    expect(notFinished.body.error.code).toBe('MATCH_NOT_FINISHED');
    expect((await players.alice.agent.post('/api/matches/999999/share')).status).toBe(404);
    expect((await request(app).post(`/api/matches/${done.id}/share`)).status).toBe(401);
  });

  it('one unguessable link per user per match; card URLs are absolute', async () => {
    const match = await finishedMatch();
    const first = await players.alice.agent.post(`/api/matches/${match.id}/share`);
    expect(first.status).toBe(201);
    const { share } = first.body;
    expect(share.shareId).toMatch(SHARE_ID_PATTERN); // 22 base64url chars = 128 random bits
    expect(share).toMatchObject({
      url: `${APP_URL}/s/${share.shareId}`,
      cards: {
        og: `${APP_URL}/api/share/${share.shareId}/card.png?format=og`,
        story: `${APP_URL}/api/share/${share.shareId}/card.png?format=story`,
      },
    });
    const again = await players.alice.agent.post(`/api/matches/${match.id}/share`);
    expect(again.body.share.shareId).toBe(share.shareId); // same link
    const bobs = await players.bob.agent.post(`/api/matches/${match.id}/share`);
    expect(bobs.body.share.shareId).not.toBe(share.shareId); // one per user
    expect(
      (await players.alice.agent.get(`/api/matches/${match.id}/share`)).body.share.shareId,
    ).toBe(share.shareId);
  });

  it('concurrent requests (double click, StrictMode) get the same link, without errors', async () => {
    const match = await finishedMatch();
    const results = await Promise.all(
      [1, 2, 3].map(() => players.alice.agent.post(`/api/matches/${match.id}/share`)),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(results.map((r) => r.body.share.shareId)).size).toBe(1);
    expect(await prisma.matchShare.count({ where: { matchId: match.id } })).toBe(1);
  });

  it('is rate-limited per user (10 cards per 10 minutes)', async () => {
    const match = await finishedMatch();
    for (let i = 0; i < 10; i++) {
      expect((await players.alice.agent.post(`/api/matches/${match.id}/share`)).status).toBe(201);
    }
    const limited = await players.alice.agent.post(`/api/matches/${match.id}/share`);
    expect(limited.status).toBe(429);
    await resetRateLimits();
  });
});

describe('public share page and cards (no login)', () => {
  it('serves the page with absolute OG/Twitter URLs, both PNG formats, no code and no test data', async () => {
    const match = await finishedMatch();
    await prisma.submission.create({
      data: {
        matchId: match.id,
        userId: players.alice.user.id,
        problemId: problem.id,
        language: 'javascript',
        code: 'SECRET_SHARED_CODE',
        status: 'ACCEPTED',
        passed: 5,
        total: 5,
      },
    });
    const { share } = (await players.alice.agent.post(`/api/matches/${match.id}/share`)).body;

    const page = await request(app).get(`/s/${share.shareId}`);
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    const og = (property) =>
      new RegExp(`<meta (?:property|name)="${property}" content="([^"]+)"`).exec(page.text)?.[1];
    expect(og('og:url')).toBe(`${APP_URL}/s/${share.shareId}`);
    expect(og('og:image')).toBe(`${APP_URL}/api/share/${share.shareId}/card.png?format=og`);
    expect(og('twitter:card')).toBe('summary_large_image');
    expect(og('twitter:image')).toBe(og('og:image'));
    expect(og('og:title')).toContain('VICTORY');
    expect(page.text).toContain('Play Code Duel');
    expect(page.text).not.toContain('SECRET_SHARED_CODE');
    expect(page.text).not.toMatch(/7771337|zq-hidden/); // hidden-test sentinels

    const ogPng = await request(app)
      .get(`/api/share/${share.shareId}/card.png?format=og`)
      .buffer(true);
    expect(ogPng.status).toBe(200);
    expect(ogPng.headers['content-type']).toBe('image/png');
    expect(pngSize(ogPng.body)).toEqual([1200, 630]);
    const story = await request(app)
      .get(`/api/share/${share.shareId}/card.png?format=story`)
      .buffer(true);
    expect(pngSize(story.body)).toEqual([1080, 1920]);
    expect((await request(app).get(`/api/share/${share.shareId}/card.png?format=gif`)).status).toBe(
      400,
    );
  }, 20_000);

  it('revoking makes the page and the cards 404; unknown ids 404', async () => {
    const match = await finishedMatch();
    const { share } = (await players.alice.agent.post(`/api/matches/${match.id}/share`)).body;
    expect((await request(app).get(`/s/${share.shareId}`)).status).toBe(200);

    expect((await players.alice.agent.delete(`/api/matches/${match.id}/share`)).status).toBe(204);
    expect((await request(app).get(`/s/${share.shareId}`)).status).toBe(404);
    expect((await request(app).get(`/api/share/${share.shareId}/card.png`)).status).toBe(404);
    expect((await players.alice.agent.get(`/api/matches/${match.id}/share`)).body.share).toBeNull();
    // A new share gets a new id; the old one stays dead.
    const fresh = (await players.alice.agent.post(`/api/matches/${match.id}/share`)).body.share;
    expect(fresh.shareId).not.toBe(share.shareId);
    expect((await request(app).get(`/s/${share.shareId}`)).status).toBe(404);

    expect((await request(app).get('/s/AAAAAAAAAAAAAAAAAAAAAA')).status).toBe(404);
    expect((await request(app).get('/s/not-a-share-id')).status).toBe(404);
  });
});

describe('templates escape user content', () => {
  const summary = {
    mode: 'Ranked duel',
    category: 'Algorithms',
    problem: 'Two <b>Sum</b>',
    difficulty: 'Easy',
    outcome: 'VICTORY',
    reason: 'Solved it first',
    stat: 'Solved in 1:00',
    eloChange: 16,
    me: { username: '<script>alert(1)</script>', elo: 1016 },
    opponent: { username: '"><img src=x onerror=alert(2)>', elo: 984, badge: null },
    date: 'Nov 22, 2026',
  };

  it('a username like <script> is text in the card and on the page', () => {
    const card = buildCard(summary, 'og', { appHost: 'localhost:5173' });
    expect(card.html).not.toContain('<script>');
    expect(card.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(card.html).not.toContain('<img');
    expect(card.html).toContain('Two &lt;b&gt;Sum&lt;/b&gt;');
    const page = buildSharePage(summary, { shareId: 'x'.repeat(22), appUrl: APP_URL });
    expect(page).not.toContain('<script>');
    expect(page).not.toMatch(/<img src=x/);
    expect(page).toContain('&lt;script&gt;');
    expect(page).toContain('&quot;&gt;&lt;img');
  });

  it('cards flag ghosts and bots', () => {
    const ghost = buildCard(
      { ...summary, opponent: { username: 'ghosty', elo: 1000, badge: 'ghost' } },
      'story',
      {
        appHost: 'x',
      },
    );
    expect(ghost.html).toContain('GHOST · REPLAY');
    expect(ghost).toMatchObject({ width: 1080, height: 1920 });
    const bot = buildCard(
      { ...summary, opponent: { username: 'Byte', elo: 900, badge: 'bot' } },
      'og',
      {
        appHost: 'x',
      },
    );
    expect(bot.html).toContain('>BOT<');
  });
});
