import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createProblem, expectNoHiddenData, register } from './helpers.js';

async function loggedInAgent() {
  const agent = request.agent(app);
  await register(agent);
  return agent;
}

describe('GET /api/problems', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/problems')).status).toBe(401);
  });

  it('lists problems ordered by difficulty with a per-user solved flag', async () => {
    const agent = await loggedInAgent();
    const add = await createProblem(prisma);
    await createProblem(prisma, { slug: 'hard-one', title: 'Hard', difficulty: 'HARD' });
    await createProblem(prisma, { slug: 'medium-one', title: 'Medium', difficulty: 'MEDIUM' });
    const me = (await agent.get('/api/auth/me')).body.user;
    await prisma.submission.create({
      data: {
        userId: me.id,
        problemId: add.id,
        language: 'python',
        code: 'x',
        status: 'ACCEPTED',
        passed: 5,
        total: 5,
      },
    });

    const res = await agent.get('/api/problems');

    expect(res.status).toBe(200);
    expect(res.body.problems.map((p) => [p.slug, p.difficulty, p.solved])).toEqual([
      ['add-two', 'EASY', true],
      ['medium-one', 'MEDIUM', false],
      ['hard-one', 'HARD', false],
    ]);
    expect(Object.keys(res.body.problems[0]).sort()).toEqual([
      'difficulty',
      'id',
      'slug',
      'solved',
      'title',
    ]);
  });

  it("doesn't count another user's accepted submission", async () => {
    const add = await createProblem(prisma);
    const other = await prisma.user.create({
      data: { username: 'other', email: 'o@x.io', passwordHash: 'x' },
    });
    await prisma.submission.create({
      data: {
        userId: other.id,
        problemId: add.id,
        language: 'python',
        code: 'x',
        status: 'ACCEPTED',
        passed: 5,
        total: 5,
      },
    });
    const agent = await loggedInAgent();

    expect((await agent.get('/api/problems')).body.problems[0].solved).toBe(false);
  });
});

describe('GET /api/problems/:slug', () => {
  it('returns the statement, starter code and sample tests with expected outputs', async () => {
    const agent = await loggedInAgent();
    await createProblem(prisma);

    const res = await agent.get('/api/problems/add-two');

    expect(res.status).toBe(200);
    expect(res.body.problem).toMatchObject({
      slug: 'add-two',
      title: 'Add Two Values',
      difficulty: 'EASY',
      description: 'Return `a + b`.',
      timeLimitMs: 1000,
      starterCode: { javascript: expect.any(String), python: expect.any(String) },
      samples: [
        { index: 0, input: [1, 2], expected: 3 },
        { index: 1, input: [10, -4], expected: 6 },
      ],
    });
  });

  it('never includes hidden tests', async () => {
    const agent = await loggedInAgent();
    await createProblem(prisma);

    const res = await agent.get('/api/problems/add-two');

    expect(res.body.problem.samples).toHaveLength(2);
    expect(res.body.problem.testCases).toBeUndefined();
    expectNoHiddenData(res.body);
  });

  it('returns 404 for an unknown slug', async () => {
    const agent = await loggedInAgent();
    const res = await agent.get('/api/problems/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Problem not found' });
  });
});
