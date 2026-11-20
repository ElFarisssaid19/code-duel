/** Test doubles for MatchManager: in-memory repo, mocked judge, recording notifier. */
import { vi } from 'vitest';
import { HIDDEN_SENTINELS } from '../helpers.js';

export const SAMPLE_TESTS = [
  { input: [1, 2], expected: 3, hidden: false },
  { input: [10, -4], expected: 6, hidden: false },
];
export const HIDDEN_TESTS = [
  {
    input: [HIDDEN_SENTINELS.inputNumber, 1],
    expected: HIDDEN_SENTINELS.expectedNumber,
    hidden: true,
  },
  {
    input: [HIDDEN_SENTINELS.inputString, 'xyz'],
    expected: HIDDEN_SENTINELS.expectedString,
    hidden: true,
  },
  { input: [0.1, 0.2], expected: 0.3, hidden: true },
];

export function makeProblem(overrides = {}) {
  return {
    id: 1,
    slug: 'add-two',
    title: 'Add Two Values',
    difficulty: 'EASY',
    description: 'Return a + b.',
    starterCode: { javascript: 'function add(a, b) {}', python: 'def add(a, b):\n    pass' },
    functionName: { javascript: 'add', python: 'add' },
    timeLimitMs: 1000,
    tests: [...SAMPLE_TESTS, ...HIDDEN_TESTS],
    ...overrides,
  };
}

/** A FRONTEND problem as loadProblem() returns it (no tests; scored by the renderer). */
export function makeFrontendProblem(overrides = {}) {
  return {
    id: 50,
    slug: 'css-circle',
    title: 'Circle',
    difficulty: 'EASY',
    category: 'FRONTEND',
    track: 'CSS',
    description: 'Draw a circle.',
    starterCode: { html: '', css: '' },
    canvasWidth: 400,
    canvasHeight: 300,
    fixedHtml: '<div class="c"></div>',
    palette: ['#000000'],
    matchThreshold: 99.5,
    targetImagePath: 'targets/css-circle.png',
    tests: [],
    ...overrides,
  };
}

/**
 * Users: { id, username, elo (ALGO), frontend?: { elo, … } }. getUser/listProblemCandidates/
 * finishMatch follow the category like the real repository.
 */
export function createFakeRepo({ users, problems = [makeProblem()] }) {
  const userMap = new Map(
    users.map((u) => [
      u.id,
      {
        wins: 0,
        losses: 0,
        draws: 0,
        ...u,
        frontend: { elo: 1000, wins: 0, losses: 0, draws: 0, ...u.frontend },
      },
    ]),
  );
  const ratingOf = (u, category) => (category === 'FRONTEND' ? u.frontend : u);
  const matches = new Map();
  const submissions = [];
  let nextId = 100;
  return {
    users: userMap,
    matches,
    submissions,
    getUser: async (id, category = 'ALGO') => {
      const u = userMap.get(id);
      return u ? { id: u.id, username: u.username, elo: ratingOf(u, category).elo } : null;
    },
    listProblemCandidates: async ({ category = 'ALGO', track = null } = {}) =>
      problems
        .filter((p) => (p.category ?? 'ALGO') === category && (!track || p.track === track))
        .map((p) => ({ id: p.id, difficulty: p.difficulty })),
    recentProblemIds: vi.fn(async () => new Set()),
    loadProblem: async (id) => problems.find((p) => p.id === id),
    createMatch: async (data) => {
      const id = nextId++;
      matches.set(id, { id, ...data });
      return { id };
    },
    updateMatch: async (id, data) => {
      Object.assign(matches.get(id), data);
      return { id };
    },
    finishMatch: vi.fn(async (id, data, statUpdates) => {
      Object.assign(matches.get(id), data);
      for (const { userId, category, eloDelta, result } of statUpdates) {
        const rating = ratingOf(userMap.get(userId), category);
        rating.elo += eloDelta;
        rating[{ win: 'wins', loss: 'losses', draw: 'draws' }[result]] += 1;
      }
    }),
    saveSubmission: async (data) => {
      submissions.push(data);
      return { id: submissions.length, createdAt: new Date() };
    },
    getMatch: async () => null,
    cancelStaleMatches: vi.fn(async () => ({ count: 0 })),
  };
}

/**
 * Verdicts are driven by the submitted code string: "solve" passes everything, "pass:N" passes
 * the first N tests, "fail" passes none. Mirrors judgeSubmission's shape (hidden tests stripped).
 */
function verdictFor(code, tests) {
  const passCount = code === 'solve' ? tests.length : Number(/^pass:(\d+)$/.exec(code)?.[1] ?? 0);
  const results = tests.map((t, index) => {
    const status = index < passCount ? 'ACCEPTED' : 'WRONG_ANSWER';
    return t.hidden
      ? { index, hidden: true, status, timeMs: 1 }
      : {
          index,
          hidden: false,
          status,
          input: t.input,
          expected: t.expected,
          actual: t.expected,
          error: null,
          logs: '',
          timeMs: 1,
        };
  });
  const failure = results.find((r) => r.status !== 'ACCEPTED');
  return {
    status: failure ? failure.status : 'ACCEPTED',
    passed: Math.min(passCount, tests.length),
    total: tests.length,
    timeMs: 5,
    memoryKb: 1000,
    tests: results,
  };
}

export function createFakeJudge() {
  return {
    judgeSolution: vi.fn(async ({ code, tests }) => verdictFor(code, tests)),
    judgeSubmission: vi.fn(async ({ code, tests }) => verdictFor(code, tests)),
  };
}

export function createRecorder() {
  const events = [];
  return {
    events,
    notify: (userId, event, payload) =>
      events.push({ userId, event, payload: structuredClone(payload) }),
    of: (userId, event) =>
      events.filter((e) => e.userId === userId && e.event === event).map((e) => e.payload),
    last: (userId, event) =>
      events.filter((e) => e.userId === userId && e.event === event).at(-1)?.payload,
  };
}
