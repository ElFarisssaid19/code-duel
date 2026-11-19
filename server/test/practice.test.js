import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createProblem, expectNoHiddenData, register, SOLUTIONS, validUser } from './helpers.js';

let agent;
let problem;

beforeEach(async () => {
  agent = request.agent(app);
  await register(agent);
  problem = await createProblem(prisma);
});

const run = (body) => agent.post('/api/practice/add-two/run').send(body);
const submit = (body) => agent.post('/api/practice/add-two/submit').send(body);

describe.each(['javascript', 'python'])('practice (%s)', (language) => {
  const code = SOLUTIONS[language];

  it('run: judges the sample tests only, with full details, and saves nothing', async () => {
    const res = await run({ language, code: code.correct });

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({
      mode: 'run',
      status: 'ACCEPTED',
      passed: 2,
      total: 2,
      compileError: null,
    });
    expect(res.body.result.tests).toEqual([
      {
        index: 0,
        status: 'ACCEPTED',
        input: [1, 2],
        expected: 3,
        actual: 3,
        error: null,
        logs: '',
        timeMs: expect.any(Number),
      },
      {
        index: 1,
        status: 'ACCEPTED',
        input: [10, -4],
        expected: 6,
        actual: 6,
        error: null,
        logs: '',
        timeMs: expect.any(Number),
      },
    ]);
    expect(res.body.submission).toBeUndefined();
    expect(await prisma.submission.count()).toBe(0);
  });

  it('submit: judges all tests, hides hidden test details, saves a submission', async () => {
    const res = await submit({ language, code: code.correct });

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({
      mode: 'submit',
      status: 'ACCEPTED',
      passed: 5,
      total: 5,
    });
    const [sample, , ...hidden] = res.body.result.tests;
    expect(sample).toHaveProperty('input');
    for (const t of hidden) expect(Object.keys(t).sort()).toEqual(['index', 'status', 'timeMs']);
    expectNoHiddenData(res.body);

    const row = await prisma.submission.findUnique({ where: { id: res.body.submission.id } });
    expect(row).toMatchObject({
      problemId: problem.id,
      matchId: null,
      language,
      code: code.correct,
      status: 'ACCEPTED',
      passed: 5,
      total: 5,
    });
    expect(res.body.submission).toMatchObject({ status: 'ACCEPTED', passed: 5, total: 5 });

    const list = await agent.get('/api/problems');
    expect(list.body.problems.find((p) => p.slug === 'add-two').solved).toBe(true);
  });

  it('submit: a wrong solution is saved with its passed count', async () => {
    const res = await submit({ language, code: code.wrong });

    // 1 - 2 ≠ 3 (sample 0 fails), 10 - -4 ≠ 6; the hidden ones fail too.
    expect(res.body.result.status).toBe('WRONG_ANSWER');
    expect(res.body.result.tests[0]).toMatchObject({
      status: 'WRONG_ANSWER',
      expected: 3,
      actual: -1,
    });
    const row = await prisma.submission.findFirst();
    expect(row).toMatchObject({ status: 'WRONG_ANSWER', passed: 0, total: 5 });
  });

  it('hidden test data never appears, even when user code echoes its inputs', async () => {
    const res = await submit({ language, code: code.leaky });

    expect(res.status).toBe(200);
    // The leaky code logs/returns/throws its inputs; sample details may show those, hidden must not.
    expect(res.body.result.tests[0].logs).toContain('args:');
    expectNoHiddenData(res.body);
  });
});

describe('practice: errors', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/practice/add-two/run')
      .send({ language: 'python', code: 'x' });
    expect(res.status).toBe(401);
  });

  it('rate-limits run + submit to 1 request per 3 seconds per user', async () => {
    expect((await run({ language: 'python', code: SOLUTIONS.python.correct })).status).toBe(200);

    const blocked = await submit({ language: 'python', code: SOLUTIONS.python.correct });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toEqual({
      code: 'RATE_LIMITED',
      message: 'You can run code once every 3 seconds. Please wait a moment.',
    });

    // Per user: someone else isn't affected.
    const other = request.agent(app);
    await register(other, { username: 'bob_2', email: 'bob@example.com' });
    const res = await other
      .post('/api/practice/add-two/run')
      .send({ language: 'python', code: SOLUTIONS.python.correct });
    expect(res.status).toBe(200);
  });

  it('lets the user run again once the window has passed', async () => {
    expect((await run({ language: 'python', code: SOLUTIONS.python.correct })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 3100));
    expect((await run({ language: 'python', code: SOLUTIONS.python.correct })).status).toBe(200);
  });

  it.each([
    ['unknown language', { language: 'ruby', code: 'x' }, 'language'],
    ['missing code', { language: 'python' }, 'code'],
    ['empty code', { language: 'python', code: '' }, 'code'],
    ['code over 20 KB', { language: 'python', code: 'x'.repeat(20 * 1024 + 1) }, 'code'],
  ])('returns 400 for %s', async (_label, body, field) => {
    const res = await run(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[field]).toEqual([expect.any(String)]);
  });

  it('accepts code of exactly 20 KB', async () => {
    const code = `${SOLUTIONS.python.correct}#${'x'.repeat(20 * 1024 - SOLUTIONS.python.correct.length - 1)}`;
    expect(Buffer.byteLength(code)).toBe(20 * 1024);
    expect((await run({ language: 'python', code })).status).toBe(200);
  });

  it('returns 404 for an unknown problem', async () => {
    const res = await agent
      .post('/api/practice/nope/submit')
      .send({ language: 'python', code: 'x' });
    expect(res.status).toBe(404);
  });

  it('reports compile errors without saving anything for run', async () => {
    const res = await run({ language: 'python', code: 'def add(a, b)\n  return a' });
    expect(res.body.result).toMatchObject({ status: 'COMPILE_ERROR', tests: [] });
    expect(res.body.result.compileError).toMatch(/SyntaxError/);
  });
});

it('uses the logged-in user for the submission', async () => {
  const res = await submit({ language: 'javascript', code: SOLUTIONS.javascript.correct });
  const user = await prisma.user.findUnique({ where: { username: validUser.username } });
  expect(
    (await prisma.submission.findUnique({ where: { id: res.body.submission.id } })).userId,
  ).toBe(user.id);
});

describe('judge hardening: samples and hidden tests run in separate executions', () => {
  // Attacker code: reads stdin, scans the interpreter's memory for argument lists, prints and
  // returns everything it finds, and raises with it.
  const memoryDumpPython = `import gc, sys
def add(a, b):
    print("stdin:", repr(sys.stdin.read()))
    found = [o for o in gc.get_objects() if isinstance(o, list) and o and all(isinstance(x, list) for x in o)]
    print("memory:", found)
    if a == 10:
        raise ValueError("dump: " + repr(found))
    return found
`;
  // Escapes the vm context through a host function to reach the real process and fs.
  const escapeJavascript = `function add(a, b) {
  const host = console.log.constructor('return this')();
  const proc = host.process;
  const fs = proc.mainModule.require('fs');
  let stdin = '';
  try { stdin = fs.readFileSync(0, 'utf8'); } catch (e) { stdin = 'read failed: ' + e.code; }
  console.log('escaped:', typeof proc.pid, 'stdin:', JSON.stringify(stdin));
  console.log('files:', fs.readdirSync('.').join(','));
  return a + b;
}`;

  it('python code that prints stdin and its whole memory never leaks hidden inputs', async () => {
    const res = await submit({ language: 'python', code: memoryDumpPython });

    expect(res.status).toBe(200);
    const [sample0, sample1] = res.body.result.tests;
    expect(sample0.logs).toContain("stdin: ''"); // stdin was consumed by the harness
    expect(sample0.logs).toContain('[[1, 2], [10, -4]]'); // the memory scan works: it finds the SAMPLE inputs
    expect(sample1.error).toContain('dump:');
    expectNoHiddenData(res.body);
    expect(await prisma.submission.count()).toBe(1);
  });

  it('javascript code that escapes the vm and reads stdin never leaks hidden inputs', async () => {
    const res = await submit({ language: 'javascript', code: escapeJavascript });

    expect(res.status).toBe(200);
    expect(res.body.result.tests[0].logs).toContain('escaped: number');
    expect(res.body.result.status).toBe('ACCEPTED');
    expectNoHiddenData(res.body);
  });
});
