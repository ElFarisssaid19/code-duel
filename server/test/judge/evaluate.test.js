import { describe, expect, it, vi } from 'vitest';
import { evaluateSolution, parseRecords, runBudgetMs } from '../../src/services/judge/evaluate.js';
import { RESULTS_FILE } from '../../src/services/judge/harness.js';

const tests = [
  { input: [1, 2], expected: 3 },
  { input: [2, 2], expected: 4 },
  { input: [5, 5], expected: 10 },
];

const jsonl = (records) => records.map((r) => JSON.stringify(r)).join('\n');
const okRecord = (index, actual, extra = {}) => ({
  type: 'test',
  index,
  status: 'ok',
  actual,
  logs: '',
  timeMs: 1.4,
  ...extra,
});

/** A mocked provider that returns the given harness records. */
function mockRunCode({ records = [], status = 'ACCEPTED', message = null, stderr = '' } = {}) {
  return vi.fn(async () => ({
    status,
    message,
    stdout: '',
    stderr,
    timeMs: 42,
    memoryKb: 9000,
    exitCode: 0,
    files: { [RESULTS_FILE]: jsonl(records) },
  }));
}

const evaluate = (runCode, overrides = {}) =>
  evaluateSolution({
    language: 'javascript',
    code: 'code',
    functionName: 'add',
    tests,
    timeLimitMs: 1000,
    runCode,
    ...overrides,
  });

describe('evaluateSolution (judge provider mocked)', () => {
  it('calls the provider with the harness, inputs only, and the total CPU budget', async () => {
    const runCode = mockRunCode({ records: [{ type: 'setup', error: null, logs: '' }] });
    await evaluate(runCode, { tests: [{ input: [1, 2], expected: 'zq-expected-sentinel' }] });

    const call = runCode.mock.calls[0][0];
    expect(call.language).toBe('javascript');
    expect(Object.keys(call.files)).toEqual(['main.js', 'solution.js']);
    expect(call.timeLimitMs).toBe(runBudgetMs(1000, 1));
    expect(call.memoryLimitMb).toBe(256);
    expect(call.collectFiles).toEqual([RESULTS_FILE]);
    expect(JSON.stringify(call)).not.toContain('zq-expected-sentinel');
  });

  it('compares outputs on the server: ACCEPTED and WRONG_ANSWER', async () => {
    const records = [
      { type: 'setup', error: null, logs: 'top-level\n' },
      okRecord(0, 3, { logs: 'hi\n' }),
      okRecord(1, 5),
      okRecord(2, 10.0000001),
      { type: 'done' },
    ];
    const verdict = await evaluate(mockRunCode({ records }));

    expect(verdict).toMatchObject({
      status: 'WRONG_ANSWER',
      passed: 2,
      total: 3,
      timeMs: 42,
      memoryKb: 9000,
    });
    expect(verdict.tests.map((t) => t.status)).toEqual(['ACCEPTED', 'WRONG_ANSWER', 'ACCEPTED']);
    expect(verdict.tests[1]).toMatchObject({ input: [2, 2], expected: 4, actual: 5 });
    expect(verdict.tests[0].logs).toBe('top-level\nhi\n'); // setup output goes with test 1
  });

  it('maps per-test harness statuses (error / timeout / memory / too slow)', async () => {
    const records = [
      { type: 'setup', error: null, logs: '' },
      { type: 'test', index: 0, status: 'error', error: 'TypeError: boom', logs: '', timeMs: 1 },
      { type: 'test', index: 1, status: 'timeout', logs: '', timeMs: 1000 },
      okRecord(2, 10, { timeMs: 1500 }), // correct but over the per-test limit
    ];
    const verdict = await evaluate(mockRunCode({ records }));

    expect(verdict.status).toBe('RUNTIME_ERROR');
    expect(verdict.tests.map((t) => t.status)).toEqual([
      'RUNTIME_ERROR',
      'TIME_LIMIT_EXCEEDED',
      'TIME_LIMIT_EXCEEDED',
    ]);
    expect(verdict.tests[0].error).toBe('TypeError: boom');

    const mem = await evaluate(
      mockRunCode({
        records: [
          { type: 'setup', error: null },
          { type: 'test', index: 0, status: 'memory', timeMs: 3 },
        ],
      }),
      { tests: [tests[0]] },
    );
    expect(mem.status).toBe('MEMORY_LIMIT_EXCEEDED');
  });

  it('marks the test running when the process was killed, and skips the rest', async () => {
    const records = [{ type: 'setup', error: null, logs: '' }, okRecord(0, 3)];
    const verdict = await evaluate(
      mockRunCode({ records, status: 'MEMORY_LIMIT_EXCEEDED', message: 'Memory limit exceeded' }),
    );

    expect(verdict.status).toBe('MEMORY_LIMIT_EXCEEDED');
    expect(verdict.passed).toBe(1);
    expect(verdict.tests.map((t) => t.status)).toEqual([
      'ACCEPTED',
      'MEMORY_LIMIT_EXCEEDED',
      'SKIPPED',
    ]);
  });

  it('reports a runtime crash with the provider message and stderr', async () => {
    const verdict = await evaluate(
      mockRunCode({
        records: [],
        status: 'RUNTIME_ERROR',
        message: 'Process killed by signal 11',
        stderr: 'Segmentation fault',
      }),
    );
    expect(verdict.tests[0]).toMatchObject({
      status: 'RUNTIME_ERROR',
      error: 'Process killed by signal 11\nSegmentation fault',
    });
    expect(verdict.tests[1].status).toBe('SKIPPED');
  });

  it('returns COMPILE_ERROR with the message and no test details', async () => {
    const verdict = await evaluate(
      mockRunCode({
        records: [
          { type: 'compile_error', message: "SyntaxError: expected ':'" },
          { type: 'done' },
        ],
      }),
    );
    expect(verdict).toMatchObject({
      status: 'COMPILE_ERROR',
      passed: 0,
      total: 3,
      tests: [],
      compileError: "SyntaxError: expected ':'",
    });
  });

  it('fails every test with the setup error (e.g. function not defined)', async () => {
    const verdict = await evaluate(
      mockRunCode({
        records: [{ type: 'setup', error: 'add is not defined', logs: '' }, { type: 'done' }],
      }),
    );
    expect(verdict.status).toBe('RUNTIME_ERROR');
    expect(
      verdict.tests.every((t) => t.status === 'RUNTIME_ERROR' && t.error === 'add is not defined'),
    ).toBe(true);
  });

  it('returns INTERNAL_ERROR when the provider fails or the harness reports nothing', async () => {
    const failed = await evaluate(
      mockRunCode({ status: 'INTERNAL_ERROR', message: 'go-judge: Internal Error' }),
    );
    expect(failed).toMatchObject({ status: 'INTERNAL_ERROR', error: 'go-judge: Internal Error' });

    const silent = await evaluate(mockRunCode({ records: [] }));
    expect(silent.status).toBe('INTERNAL_ERROR');
  });
});

describe('parseRecords / runBudgetMs', () => {
  it('ignores blank and half-written lines', () => {
    expect(parseRecords('{"type":"setup"}\n\n{"type":"te')).toEqual([{ type: 'setup' }]);
    expect(parseRecords(null)).toEqual([]);
  });

  it('budgets per-test time plus startup, capped at 20 s', () => {
    expect(runBudgetMs(2000, 8)).toBe(17_000);
    expect(runBudgetMs(2000, 50)).toBe(20_000);
    expect(runBudgetMs(1000, 0)).toBe(2000);
  });
});
