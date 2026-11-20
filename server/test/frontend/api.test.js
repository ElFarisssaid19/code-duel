/**
 * FRONTEND API: problem filters and brief, target images, practice submit (real renderer),
 * track rule enforcement, category-aware leaderboard / profile, match details with previews.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { resetRateLimits } from '../../src/middleware/rateLimit.js';
import { createMatch, createUser } from '../fixtures.js';
import { createFrontendProblem, FRONTEND } from '../frontendFixtures.js';
import { createProblem, getTokenCookie, register, SOLUTIONS } from '../helpers.js';

let agent;
let me;

/** [width, height] from a PNG's IHDR chunk (no image library needed). */
function pngSize(buffer) {
  expect(buffer.subarray(1, 4).toString()).toBe('PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

async function login(username) {
  const a = request.agent(app);
  const res = await register(a, { username, email: `${username}@fe.test` });
  return { agent: a, user: res.body.user, cookie: getTokenCookie(res) };
}

beforeEach(async () => {
  ({ agent, user: me } = await login('fe_player'));
});

const submit = (slug, body) => agent.post(`/api/practice/${slug}/submit`).send(body);
const traffic = FRONTEND['css-traffic-light'];
const recipe = FRONTEND['html-recipe-page'];

describe('GET /api/problems?category', () => {
  beforeEach(async () => {
    await createProblem(prisma); // ALGO
    await createFrontendProblem(prisma, 'css-traffic-light');
    await createFrontendProblem(prisma, 'html-recipe-page');
  });

  it('defaults to ALGO (unchanged list), FRONTEND items have a track and the best score', async () => {
    const algo = await agent.get('/api/problems');
    expect(algo.body.problems.map((p) => p.slug)).toEqual(['add-two']);
    expect(Object.keys(algo.body.problems[0]).sort()).toEqual([
      'difficulty',
      'id',
      'slug',
      'solved',
      'title',
    ]);

    const fe = await agent.get('/api/problems?category=FRONTEND');
    expect(fe.body.problems.map((p) => [p.slug, p.track, p.solved, p.bestScore])).toEqual([
      ['html-recipe-page', 'HTML', false, null],
      ['css-traffic-light', 'CSS', false, null],
    ]);

    const css = await agent.get('/api/problems?category=FRONTEND&track=CSS');
    expect(css.body.problems.map((p) => p.slug)).toEqual(['css-traffic-light']);
    expect((await agent.get('/api/problems?category=WEB')).status).toBe(400);
    expect((await agent.get('/api/problems?category=FRONTEND&track=JS')).status).toBe(400);
  });

  it('GET /api/problems/:slug returns the FRONTEND brief, never the reference solution', async () => {
    const res = await agent.get('/api/problems/css-traffic-light');
    expect(res.status).toBe(200);
    expect(res.body.problem).toEqual({
      id: expect.any(Number),
      slug: 'css-traffic-light',
      title: 'Traffic Light',
      difficulty: 'MEDIUM',
      category: 'FRONTEND',
      track: 'CSS',
      description: traffic.description,
      starterCode: traffic.starter,
      canvas: { width: 400, height: 300 },
      palette: traffic.palette,
      fixedHtml: traffic.fixedHtml,
      threshold: 99.5,
      editable: { html: false, css: true },
      trackRules: expect.stringMatching(/CSS only/),
      targetImageUrl: '/api/problems/css-traffic-light/target.png',
    });
    expect(JSON.stringify(res.body)).not.toContain('border-radius: 50%'); // reference CSS
    const html = await agent.get('/api/problems/html-recipe-page');
    expect(html.body.problem).toMatchObject({ fixedHtml: null, threshold: 98 });
    expect(JSON.stringify(html.body)).not.toContain('<ol>'); // reference HTML markup
  });

  it('serves target images (auth required, FRONTEND only)', async () => {
    const res = await agent.get('/api/problems/css-traffic-light/target.png').buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(pngSize(res.body)).toEqual([400, 300]);
    expect((await agent.get('/api/problems/add-two/target.png')).status).toBe(404);
    expect((await request(app).get('/api/problems/css-traffic-light/target.png')).status).toBe(401);
  });
});

describe('POST /api/practice/:slug/submit (FRONTEND)', () => {
  beforeEach(async () => {
    await createFrontendProblem(prisma, 'css-traffic-light');
    await createFrontendProblem(prisma, 'html-recipe-page');
  });

  it('a partial solution scores below the threshold, with a diff image; the reference is solved', async () => {
    const partial = await submit('css-traffic-light', {
      css: traffic.reference.css.replace(/\.green \{[^}]*\}/, ''),
    });
    expect(partial.status).toBe(200);
    expect(partial.body).toMatchObject({ solved: false, threshold: 99.5 });
    expect(partial.body.score).toBeGreaterThan(50);
    expect(partial.body.score).toBeLessThan(99.5);
    expect(pngSize(Buffer.from(partial.body.diffImage, 'base64'))).toEqual([400, 300]);

    await resetRateLimits();
    const solved = await submit('css-traffic-light', { css: traffic.reference.css });
    expect(solved.body).toMatchObject({
      score: 100,
      solved: true,
      charCount: traffic.reference.css.replace(/\s+/g, '').length,
      submission: { status: 'ACCEPTED', score: 100 },
    });

    const row = await prisma.submission.findFirst({
      where: { userId: me.id, status: 'ACCEPTED' },
    });
    expect(row).toMatchObject({ language: 'css', code: '', css: traffic.reference.css, passed: 1 });
    const list = await agent.get('/api/problems?category=FRONTEND&track=CSS');
    expect(list.body.problems[0]).toMatchObject({ solved: true, bestScore: 100 });
  });

  it('enforces the track rules server-side with a clear 400', async () => {
    const css = await submit('html-recipe-page', { html: recipe.reference.html, css: 'h1{}' });
    expect(css.status).toBe(400);
    expect(css.body.error).toMatchObject({
      code: 'TRACK_RULE_VIOLATION',
      message: 'The HTML track does not allow CSS: send HTML only.',
      details: { css: [expect.any(String)] },
    });
    await resetRateLimits();
    const style = await submit('html-recipe-page', { html: '<h1 style="color:red">Pancakes</h1>' });
    expect(style.body.error).toMatchObject({
      code: 'TRACK_RULE_VIOLATION',
      details: { html: [expect.stringMatching(/style attributes/)] },
    });
    await resetRateLimits();
    const html = await submit('css-traffic-light', { html: '<p>x</p>', css: '.light{}' });
    expect(html.body.error.message).toBe('The CSS track has a fixed HTML: send CSS only.');
    await resetRateLimits();
    const image = await submit('css-traffic-light', {
      css: 'body{background:url(data:image/png;base64,AAAA)}',
    });
    expect(image.body.error.message).toMatch(/Embedded images/);
  });

  it('validates payloads: no "run", wrong category, 20 KB, rate limit', async () => {
    const run = await agent.post('/api/practice/css-traffic-light/run').send({ css: 'x{}' });
    expect(run.body.error).toMatchObject({ code: 'NOT_SUPPORTED' });
    await resetRateLimits();
    const algoPayload = await submit('css-traffic-light', { language: 'javascript', code: 'x' });
    expect(algoPayload.body.error).toMatchObject({ code: 'WRONG_CATEGORY' });
    await resetRateLimits();
    const big = await submit('css-traffic-light', { css: 'x'.repeat(20 * 1024 + 1) });
    expect(big.status).toBe(400);
    expect(big.body.error.code).toBe('VALIDATION_ERROR');
    await resetRateLimits();
    expect((await submit('css-traffic-light', { css: '.light{}' })).status).toBe(200);
    expect((await submit('css-traffic-light', { css: '.light{}' })).status).toBe(429);
  });

  it('an ALGO problem refuses a FRONTEND payload and still judges ALGO payloads', async () => {
    await createProblem(prisma);
    const res = await submit('add-two', { html: '<p>x</p>' });
    expect(res.body.error).toMatchObject({ code: 'WRONG_CATEGORY' });
    await resetRateLimits();
    const ok = await submit('add-two', {
      language: 'javascript',
      code: SOLUTIONS.javascript.correct,
    });
    expect(ok.body.result.status).toBe('ACCEPTED');
  });
});

describe('category-aware leaderboard and profile', () => {
  it('ALGO and FRONTEND have separate ratings, ranks, stats and ELO histories', async () => {
    const algoProblem = await createProblem(prisma);
    const feProblem = await createFrontendProblem(prisma, 'css-traffic-light');
    const ann = await createUser('ann_fe', {
      elo: 1200,
      wins: 3,
      frontend: { elo: 984, losses: 1 },
    });
    const ben = await createUser('ben_fe', {
      elo: 900,
      losses: 3,
      frontend: { elo: 1016, wins: 1 },
    });
    await createMatch({ a: ben, b: ann, problem: feProblem, winner: ben, delta: 16 });
    await prisma.match.updateMany({
      where: { problemId: feProblem.id },
      data: { category: 'FRONTEND' },
    });
    await createMatch({ a: ann, b: ben, problem: algoProblem, winner: ann, delta: 16, minute: 20 });

    const algo = await agent.get('/api/leaderboard');
    expect(algo.body).toMatchObject({ category: 'ALGO' });
    expect(algo.body.entries.map((e) => [e.username, e.elo])).toEqual([
      ['ann_fe', 1200],
      ['ben_fe', 900],
    ]);
    const fe = await agent.get('/api/leaderboard?category=FRONTEND');
    expect(fe.body.entries.map((e) => [e.rank, e.username, e.elo])).toEqual([
      [1, 'ben_fe', 1016],
      [2, 'ann_fe', 984],
    ]);
    expect((await agent.get('/api/leaderboard?category=X')).status).toBe(400);

    const benFe = await agent.get('/api/users/ben_fe/profile?category=FRONTEND');
    expect(benFe.body.profile).toMatchObject({
      elo: 1016,
      rank: 1,
      wins: 1,
      losses: 0,
      gamesPlayed: 1,
    });
    const benAlgo = await agent.get('/api/users/ben_fe/profile');
    expect(benAlgo.body.profile).toMatchObject({ elo: 900, rank: 2, wins: 0, losses: 3 });

    const history = await agent.get('/api/users/ben_fe/elo-history?category=FRONTEND');
    expect(history.body.points.map((p) => p.elo)).toEqual([1000, 1016]);
    const matches = await agent.get('/api/users/ben_fe/matches?category=FRONTEND');
    expect(matches.body.matches).toHaveLength(1);
    expect(matches.body.matches[0]).toMatchObject({
      category: 'FRONTEND',
      track: 'CSS',
      score: null,
    });
  });

  it('a new user has 1000 in both categories', async () => {
    expect(me.ratings).toEqual({
      ALGO: { elo: 1000, wins: 0, losses: 0, draws: 0, bestElo: 1000 },
      FRONTEND: { elo: 1000, wins: 0, losses: 0, draws: 0, bestElo: 1000 },
    });
    expect(await prisma.userRating.count({ where: { userId: me.id } })).toBe(2);
  });
});

describe('FRONTEND match details', () => {
  it('shows scores, final previews to everyone after the match, and code to participants only', async () => {
    const problem = await createFrontendProblem(prisma, 'css-traffic-light');
    const alice = await login('alice_fe');
    const bob = await login('bob_fe');
    const match = await createMatch({
      a: alice.user,
      b: bob.user,
      problem,
      winner: null,
      status: 'ACTIVE',
      testCount: 1,
    });
    await prisma.match.update({
      where: { id: match.id },
      data: {
        category: 'FRONTEND',
        player1Score: 100,
        player2Score: 62.5,
        player1Chars: 300,
        player2Chars: 40,
      },
    });
    const sub = (who, css, score, seconds) =>
      prisma.submission.create({
        data: {
          matchId: match.id,
          userId: who.user.id,
          problemId: problem.id,
          language: 'css',
          code: '',
          css,
          score,
          charCount: css.length,
          status: score >= 99.5 ? 'ACCEPTED' : 'WRONG_ANSWER',
          passed: score >= 99.5 ? 1 : 0,
          total: 1,
          createdAt: new Date(match.startedAt.getTime() + seconds * 1000),
        },
      });
    await sub(alice, '.light{}', 20, 10);
    await sub(alice, traffic.reference.css, 100, 60);
    await sub(alice, '.light{display:none}', 30, 90); // later but worse
    await sub(bob, '.red{}', 62.5, 30);

    // Live: previews and code are hidden from everyone, including the opponent.
    const live = await bob.agent.get(`/api/matches/${match.id}`);
    expect(live.body.match.previews).toMatchObject({
      available: false,
      reason: 'MATCH_NOT_FINISHED',
    });
    expect(
      (await bob.agent.get(`/api/matches/${match.id}/preview/${alice.user.id}.png`)).status,
    ).toBe(403);
    expect((await bob.agent.get(`/api/matches/${match.id}/code`)).status).toBe(403);

    await prisma.match.update({
      where: { id: match.id },
      data: {
        status: 'FINISHED',
        endReason: 'SOLVED',
        winnerId: alice.user.id,
        endedAt: new Date(),
      },
    });
    const done = await agent.get(`/api/matches/${match.id}`); // a third user
    expect(done.body.match).toMatchObject({
      category: 'FRONTEND',
      track: 'CSS',
      canvas: { width: 400, height: 300 },
      players: [
        { username: 'alice_fe', score: 100, charCount: 300 },
        { username: 'bob_fe', score: 62.5, charCount: 40 },
      ],
      previews: { available: true, reason: null },
    });
    expect(done.body.match.timeline.map((t) => t.score)).toEqual([20, 62.5, 100, 30]);
    expect(JSON.stringify(done.body)).not.toContain('.light{');

    const preview = await agent.get(done.body.match.previews.players[0].url).buffer(true);
    expect(preview.status).toBe(200);
    expect(preview.headers['content-type']).toBe('image/png');
    const target = await agent.get('/api/problems/css-traffic-light/target.png').buffer(true);
    expect(preview.body.equals(target.body)).toBe(true); // best submission = the reference

    expect((await agent.get(`/api/matches/${match.id}/code`)).status).toBe(403);
    const code = await alice.agent.get(`/api/matches/${match.id}/code`);
    expect(code.body.players[0].submission).toMatchObject({
      css: traffic.reference.css,
      score: 100,
    });
    expect(code.body.players[1].submission).toMatchObject({ css: '.red{}', score: 62.5 });
  });
});
