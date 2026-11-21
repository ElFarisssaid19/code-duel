/**
 * DEBUG category: lines changed, seed checks (real judge, both languages), match rules
 * (durations, timeout tiebreaks) and ratings isolated from ALGO and FRONTEND.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../client/src/lib/linesChanged.js';
import debugProblems from '../../prisma/seed/debug/index.js';
import { validateDebugProblem, verifyDebugProblem } from '../../prisma/seed/debugVerify.js';
import { linesChanged } from '../../src/services/debug/linesChanged.js';
import { debugTimeoutWinner, MatchManager } from '../../src/services/match/MatchManager.js';
import { createFakeRepo, createRecorder, makeProblem } from '../match/fakes.js';

describe('lines changed', () => {
  const buggy = 'function f(a) {\n  let x = 0;\n  return x;\n}\n';
  const cases = [
    ['identical', buggy, 0, buggy],
    ['one line edited', buggy, 1, buggy.replace('let x = 0', 'let x = a')],
    ['one line added', buggy, 1, buggy.replace('  return x;', '  x++;\n  return x;')],
    ['one line removed', buggy, 1, buggy.replace('  let x = 0;\n', '')],
    [
      'two separate edits',
      buggy,
      2,
      buggy.replace('let x = 0', 'let x = 1').replace('return x', 'return -x'),
    ],
    ['two lines replaced by three', 'a\nb\nc\nd', 3, 'a\nX\nY\nZ\nd'],
    [
      'trailing whitespace, CRLF and trailing blank lines are ignored',
      buggy,
      0,
      buggy.replace(/\n/g, '  \r\n') + '\n\n',
    ],
    ['indentation counts (Python)', 'if a:\n    b()\n', 1, 'if a:\nb()\n'],
    ['empty → two lines', '', 2, 'x\ny'],
  ];
  it.each(cases)('%s', (_, original, expected, edited = original) => {
    expect(linesChanged(original, edited)).toBe(expected);
  });

  it('the client copy (live counter) gives the same results', () => {
    for (const [, original, , edited = original] of cases) {
      expect(client.linesChanged(original, edited)).toBe(linesChanged(original, edited));
    }
    const p = debugProblems[9];
    for (const language of ['javascript', 'python']) {
      expect(client.linesChanged(p.buggy[language], p.fixed[language])).toBe(
        linesChanged(p.buggy[language], p.fixed[language]),
      );
    }
  });

  it('each seeded fix changes at most a few lines (the bug count, roughly)', () => {
    for (const p of debugProblems) {
      for (const language of ['javascript', 'python']) {
        const changed = linesChanged(p.buggy[language], p.fixed[language]);
        expect(changed, `${p.slug} ${language}`).toBeGreaterThanOrEqual(1);
        expect(changed, `${p.slug} ${language}`).toBeLessThanOrEqual(p.bugCount + 2);
      }
    }
  });
});

describe('seeded DEBUG problems (real go-judge)', () => {
  it('10 problems: 4 easy, 4 medium, 2 hard, 1-3 bugs, valid definitions', () => {
    expect(debugProblems).toHaveLength(10);
    const count = (d) => debugProblems.filter((p) => p.difficulty === d).length;
    expect([count('EASY'), count('MEDIUM'), count('HARD')]).toEqual([4, 4, 2]);
    for (const p of debugProblems) expect(validateDebugProblem(p), p.slug).toEqual([]);
  });

  it.each(debugProblems.map((p) => [p.slug, p]))(
    '%s: the buggy code fails a sample and a hidden test, the fix passes everything (JS + Python)',
    async (_, p) => {
      const { failures, report } = await verifyDebugProblem(p);
      expect(failures).toEqual([]);
      expect(report.map((r) => r.language)).toEqual(['javascript', 'python']);
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------------------------
// Match rules (fake repo, fake judge, fake timers)

const A = 1;
const B = 2;
const BUGGY = { javascript: 'line 1\nline 2\nline 3\nline 4\nline 5\n', python: 'p\n' };
/** Submitted code = the buggy code with its first `edits` lines replaced by "pass:N" markers. */
const code = (passed, edits = 1) =>
  BUGGY.javascript
    .split('\n')
    .map((line, i) => (i < edits ? `pass:${passed} edit ${i}` : line))
    .join('\n');

/** Fake judge: "pass:N" anywhere in the code passes the first N tests (5 tests in total). */
const judge = {
  judgeSolution: vi.fn(),
  judgeSubmission: vi.fn(async ({ code: source, tests }) => {
    const passed = Math.min(Number(/pass:(\d+)/.exec(source)?.[1] ?? 0), tests.length);
    return {
      status: passed === tests.length ? 'ACCEPTED' : 'WRONG_ANSWER',
      passed,
      total: tests.length,
      timeMs: 1,
      memoryKb: 1,
      tests: tests.map((t, index) => ({
        index,
        hidden: true,
        status: index < passed ? 'ACCEPTED' : 'WRONG_ANSWER',
        timeMs: 1,
      })),
    };
  }),
};

let repo;
let recorder;
let manager;
beforeEach(() => {
  vi.useFakeTimers();
  repo = createFakeRepo({
    users: [
      { id: A, username: 'alice', elo: 1400, frontend: { elo: 1200 }, debug: { elo: 1000 } },
      { id: B, username: 'bob', elo: 1400, frontend: { elo: 1200 }, debug: { elo: 1000 } },
    ],
    problems: [makeProblem({ id: 7, category: 'DEBUG', starterCode: BUGGY, bugCount: 2 })],
  });
  recorder = createRecorder();
  manager = new MatchManager({ repo, judge, notify: recorder.notify });
});
afterEach(() => {
  manager.shutdown();
  vi.useRealTimers();
});

async function startDebug() {
  await manager.joinQueue(A, { category: 'DEBUG' });
  await manager.joinQueue(B, { category: 'DEBUG' });
  await vi.advanceTimersByTimeAsync(0);
  const { matchId } = recorder.last(A, 'match:found');
  await manager.rejoin(A, matchId);
  await manager.rejoin(B, matchId);
  await vi.advanceTimersByTimeAsync(3000);
  return matchId;
}
const submit = (userId, source) => manager.submit(userId, { language: 'javascript', code: source });
const endOf = () => recorder.last(A, 'match:end');
const SIX_MINUTES = 6 * 60_000;

describe('DEBUG match rules', () => {
  it('EASY lasts 6 minutes; the problem shows the buggy code and the bug count', async () => {
    const matchId = await startDebug();
    const start = recorder.last(A, 'match:start');
    expect(start.endsAt - Date.now()).toBe(SIX_MINUTES);
    expect(start.problem).toMatchObject({ category: 'DEBUG', bugCount: 2, starterCode: BUGGY });
    expect(repo.matches.get(matchId)).toMatchObject({ category: 'DEBUG', durationMs: SIX_MINUTES });
  });

  it('records lines changed per submission and in the progress the opponent sees', async () => {
    await startDebug();
    const res = await submit(A, code(3, 2));
    expect(res.linesChanged).toBe(2);
    expect(recorder.last(B, 'opponent:progress')).toEqual({
      userId: A,
      passed: 3,
      total: 5,
      attempts: 1,
      linesChanged: 2,
    });
    expect(repo.submissions.at(-1)).toMatchObject({ linesChanged: 2, passed: 3 });
  });

  it('passing every test wins immediately; only DEBUG ratings change', async () => {
    await startDebug();
    await submit(B, code(5, 1));
    expect(endOf()).toMatchObject({ winnerId: B, reason: 'SOLVED', category: 'DEBUG' });
    const [alice, bob] = [repo.users.get(A), repo.users.get(B)];
    expect(bob.debug).toMatchObject({ elo: 1016, wins: 1 });
    expect(alice.debug).toMatchObject({ elo: 984, losses: 1 });
    expect([alice.elo, alice.wins, bob.elo, bob.frontend.elo, alice.frontend.losses]).toEqual([
      1400, 0, 1400, 1200, 0,
    ]);
    expect(repo.finishMatch.mock.calls[0][2].every((u) => u.category === 'DEBUG')).toBe(true);
    expect(repo.finishMatch.mock.calls[0][1]).toMatchObject({ player2Lines: 1 });
  });

  it('timeout: most tests passed wins', async () => {
    await startDebug();
    await submit(A, code(4, 3));
    await submit(B, code(2, 1));
    await vi.advanceTimersByTimeAsync(SIX_MINUTES);
    expect(endOf()).toMatchObject({ winnerId: A, reason: 'TIMEOUT' });
  });

  it('timeout: same tests → fewer lines changed wins', async () => {
    await startDebug();
    await submit(A, code(3, 3));
    await submit(B, code(3, 1));
    await vi.advanceTimersByTimeAsync(SIX_MINUTES);
    expect(endOf()).toMatchObject({ winnerId: B, reason: 'TIMEOUT' });
    expect(endOf().summary.players.find((p) => p.userId === B).linesChanged).toBe(1);
  });

  it('timeout: same tests and lines → the earlier submission wins; a leaner resubmission counts', async () => {
    await startDebug();
    await submit(B, code(3, 2));
    await vi.advanceTimersByTimeAsync(5000);
    await submit(A, code(3, 2));
    await vi.advanceTimersByTimeAsync(SIX_MINUTES);
    expect(endOf()).toMatchObject({ winnerId: B, reason: 'TIMEOUT' });
  });

  it('timeout: both at 0 tests → draw', async () => {
    await startDebug();
    await submit(A, code(0, 1));
    await vi.advanceTimersByTimeAsync(SIX_MINUTES);
    expect(endOf()).toMatchObject({ winnerId: null, reason: 'TIMEOUT' });
    expect(repo.users.get(A).debug).toMatchObject({ elo: 1000, draws: 1 });
  });

  it('pure tiebreak function', () => {
    const p = (userId, passed, bestLines, reachedAt) => ({ userId, passed, bestLines, reachedAt });
    expect(debugTimeoutWinner(p(1, 0, null, null), p(2, 0, null, null))).toBeNull();
    expect(debugTimeoutWinner(p(1, 4, 9, 5), p(2, 3, 1, 1))).toBe(1);
    expect(debugTimeoutWinner(p(1, 3, 2, 5), p(2, 3, 1, 9))).toBe(2);
    expect(debugTimeoutWinner(p(1, 3, 2, 5), p(2, 3, 2, 9))).toBe(1);
    expect(debugTimeoutWinner(p(1, 3, 2, 5), p(2, 3, 2, 5))).toBeNull();
  });
});
