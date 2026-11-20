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
  'preferredLanguage',
  'ratings',
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

// ---------------------------------------------------------------------------------------------
// Practice fixtures. Hidden tests use distinctive values so tests can search every response
// for any trace of hidden data.

export const HIDDEN_SENTINELS = {
  inputNumber: 7_771_337,
  expectedNumber: 7_771_338, // 7_771_337 + 1
  inputString: 'zq-hidden-input-',
  expectedString: 'zq-hidden-input-xyz',
};

export const SOLUTIONS = {
  javascript: {
    correct: 'function add(a, b) {\n  return a + b;\n}\n',
    wrong: 'function add(a, b) {\n  return a - b;\n}\n',
    // Tries every way of echoing its inputs back: logs, error messages, return value.
    leaky:
      'function add(a, b) {\n  console.log("args:", a, b);\n  if (typeof a === "string") throw new Error("input was " + a + b);\n  return [a, b];\n}\n',
  },
  python: {
    correct: 'def add(a, b):\n    return a + b\n',
    wrong: 'def add(a, b):\n    return a - b\n',
    leaky:
      'def add(a, b):\n    print("args:", a, b)\n    if isinstance(a, str):\n        raise ValueError("input was " + a + b)\n    return [a, b]\n',
  },
};

/** Creates an "add" problem: 2 samples + 3 hidden tests containing the sentinels. */
export async function createProblem(prisma, overrides = {}) {
  const { inputNumber, expectedNumber, inputString, expectedString } = HIDDEN_SENTINELS;
  const tests = [
    { input: [1, 2], expected: 3, hidden: false },
    { input: [10, -4], expected: 6, hidden: false },
    { input: [inputNumber, 1], expected: expectedNumber, hidden: true },
    { input: [inputString, 'xyz'], expected: expectedString, hidden: true },
    { input: [0.1, 0.2], expected: 0.3, hidden: true },
  ];
  return prisma.problem.create({
    data: {
      slug: 'add-two',
      title: 'Add Two Values',
      description: 'Return `a + b`.',
      difficulty: 'EASY',
      starterCode: {
        javascript: 'function add(a, b) {\n}\n',
        python: 'def add(a, b):\n    pass\n',
      },
      functionName: { javascript: 'add', python: 'add' },
      timeLimitMs: 1000,
      ...overrides,
      testCases: {
        create: tests.map((t, order) => ({
          order,
          input: t.input,
          expectedOutput: t.expected,
          isHidden: t.hidden,
        })),
      },
    },
  });
}

/** Asserts no hidden-test sentinel appears anywhere in a response body. */
export function expectNoHiddenData(body) {
  const raw = JSON.stringify(body);
  for (const value of Object.values(HIDDEN_SENTINELS)) expect(raw).not.toContain(String(value));
  expect(raw).not.toContain('zq-hidden');
}
