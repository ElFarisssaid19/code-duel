/**
 * Function-style evaluation: run all tests in one sandbox execution through the harness,
 * then compare actual vs expected HERE, on the server (expected outputs never enter the
 * sandbox). Provider-agnostic: receives `runCode` from the caller.
 */
import { outputsEqual } from './compare.js';
import { buildHarnessRun, RESULTS_FILE } from './harness.js';
import { STATUS } from './statuses.js';

/** Interpreter startup + harness overhead allowed on top of the per-test limits. */
const STARTUP_BUDGET_MS = 1000;
/** Hard cap on the CPU budget of one run, whatever the number of tests. */
const MAX_RUN_MS = 20_000;
const MAX_CRASH_OUTPUT = 2000;

/**
 * Each test gets timeLimitMs inside the harness (enforced per test there). The sandbox CPU
 * limit is the sum plus startup, a safety net for code the harness can't interrupt.
 */
export const runBudgetMs = (timeLimitMs, testCount) =>
  Math.min(timeLimitMs * Math.max(testCount, 1) + STARTUP_BUDGET_MS, MAX_RUN_MS);

/** Parses the harness's JSON-lines output, ignoring anything malformed. */
export function parseRecords(text) {
  const records = [];
  for (const line of (text ?? '').split('\n')) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record && typeof record.type === 'string') records.push(record);
    } catch {
      // A killed process can leave a half-written last line.
    }
  }
  return records;
}

const tail = (text) =>
  text.length > MAX_CRASH_OUTPUT ? `…${text.slice(-MAX_CRASH_OUTPUT)}` : text;

/** Status + message for the test that was running when the process died. */
function crashOutcome(raw) {
  if ([STATUS.TIME_LIMIT_EXCEEDED, STATUS.MEMORY_LIMIT_EXCEEDED].includes(raw.status)) {
    return { status: raw.status, error: raw.message };
  }
  if (raw.status === STATUS.RUNTIME_ERROR) {
    const stderr = raw.stderr?.trim();
    return {
      status: raw.status,
      error: [raw.message, stderr && tail(stderr)].filter(Boolean).join('\n'),
    };
  }
  // The process exited normally but the harness didn't report this test: harness bug.
  return { status: STATUS.INTERNAL_ERROR, error: 'The test harness did not report a result' };
}

function testOutcome(record, expected, timeLimitMs) {
  switch (record.status) {
    case 'ok':
      if (record.timeMs > timeLimitMs) {
        return {
          status: STATUS.TIME_LIMIT_EXCEEDED,
          actual: record.actual,
          error: `Time limit exceeded (${timeLimitMs} ms)`,
        };
      }
      return {
        status: outputsEqual(record.actual, expected) ? STATUS.ACCEPTED : STATUS.WRONG_ANSWER,
        actual: record.actual,
      };
    case 'timeout':
      return {
        status: STATUS.TIME_LIMIT_EXCEEDED,
        error: `Time limit exceeded (${timeLimitMs} ms)`,
      };
    case 'memory':
      return { status: STATUS.MEMORY_LIMIT_EXCEEDED, error: 'Memory limit exceeded' };
    case 'error':
      return { status: STATUS.RUNTIME_ERROR, error: record.error };
    default:
      return { status: STATUS.INTERNAL_ERROR, error: `Unknown harness status "${record.status}"` };
  }
}

/**
 * Turns the raw run + harness records into a verdict.
 * tests: [{ input, expected }] in order. Exported for unit tests.
 */
export function buildVerdict({ raw, records, tests, timeLimitMs }) {
  const summary = {
    total: tests.length,
    timeMs: raw.timeMs ?? null,
    memoryKb: raw.memoryKb ?? null,
  };

  if (raw.status === STATUS.INTERNAL_ERROR) {
    return { ...summary, status: STATUS.INTERNAL_ERROR, passed: 0, error: raw.message, tests: [] };
  }

  const compileError = records.find((r) => r.type === 'compile_error');
  if (compileError) {
    return {
      ...summary,
      status: STATUS.COMPILE_ERROR,
      passed: 0,
      compileError: compileError.message,
      tests: [],
    };
  }

  const setup = records.find((r) => r.type === 'setup');
  const byIndex = new Map(records.filter((r) => r.type === 'test').map((r) => [r.index, r]));
  let crashReported = false;

  const results = tests.map(({ input, expected }, index) => {
    const base = { index, input, expected, actual: null, error: null, logs: '', timeMs: null };
    if (setup?.error) return { ...base, status: STATUS.RUNTIME_ERROR, error: setup.error };

    const record = byIndex.get(index);
    if (!record) {
      // The process died during this test (or earlier): report it once, skip the rest.
      if (crashReported) return { ...base, status: STATUS.SKIPPED };
      crashReported = true;
      return { ...base, ...crashOutcome(raw) };
    }
    return {
      ...base,
      ...testOutcome(record, expected, timeLimitMs),
      logs: record.logs ?? '',
      timeMs: typeof record.timeMs === 'number' ? Math.round(record.timeMs) : null,
    };
  });

  // Output printed while loading the code (top-level prints) goes with the first test.
  if (setup?.logs && results.length > 0) results[0].logs = setup.logs + results[0].logs;

  const firstFailure = results.find((r) => r.status !== STATUS.ACCEPTED);
  return {
    ...summary,
    status: firstFailure ? firstFailure.status : STATUS.ACCEPTED,
    passed: results.filter((r) => r.status === STATUS.ACCEPTED).length,
    tests: results,
  };
}

/**
 * Runs `code` against `tests` ([{ input: [...args], expected }]) with the given runCode.
 * Returns { status, passed, total, timeMs, memoryKb, compileError?, error?, tests: [...] }.
 */
export async function evaluateSolution({
  language,
  code,
  functionName,
  tests,
  timeLimitMs,
  memoryLimitMb = 256,
  captureLogs = true,
  runCode,
}) {
  const run = buildHarnessRun({
    language,
    code,
    functionName,
    inputs: tests.map((t) => t.input),
    timeLimitMs,
    captureLogs,
  });
  const raw = await runCode({
    language,
    files: run.files,
    stdin: run.stdin,
    collectFiles: run.collectFiles,
    timeLimitMs: runBudgetMs(timeLimitMs, tests.length),
    memoryLimitMb,
  });
  const records = parseRecords(raw.files?.[RESULTS_FILE]);
  return buildVerdict({ raw, records, tests, timeLimitMs });
}

/**
 * Merges the verdicts of the two separate executions of a submission: sample tests (full
 * details) and hidden tests. Hidden tests are reduced to { index, hidden, status, timeMs } HERE,
 * so their inputs, expected/actual outputs, logs and errors never leave the judge service.
 * Indices continue after the samples.
 */
export function combineVerdicts(samples, hidden) {
  const sampleTests = samples.tests.map((t) => ({ ...t, hidden: false }));
  if (!hidden) return { ...samples, tests: sampleTests };

  const total = samples.total + hidden.total;
  const base = {
    total,
    timeMs: (samples.timeMs ?? 0) + (hidden.timeMs ?? 0),
    memoryKb: Math.max(samples.memoryKb ?? 0, hidden.memoryKb ?? 0),
  };

  if (samples.status === STATUS.INTERNAL_ERROR || hidden.status === STATUS.INTERNAL_ERROR) {
    // Internal errors come from the judge infrastructure, not user code; logged server-side only.
    const error = samples.status === STATUS.INTERNAL_ERROR ? samples.error : hidden.error;
    return { ...base, status: STATUS.INTERNAL_ERROR, passed: 0, error, tests: [] };
  }
  if (samples.status === STATUS.COMPILE_ERROR) {
    // Syntax errors only depend on the code, so the sample run's message is safe to show.
    return {
      ...base,
      status: STATUS.COMPILE_ERROR,
      passed: 0,
      compileError: samples.compileError,
      tests: [],
    };
  }

  const hiddenTests =
    hidden.tests.length > 0
      ? hidden.tests.map((t) => ({
          index: samples.total + t.index,
          hidden: true,
          status: t.status,
          timeMs: t.timeMs,
        }))
      : Array.from({ length: hidden.total }, (_, i) => ({
          index: samples.total + i,
          hidden: true,
          status: hidden.status,
          timeMs: null,
        }));
  const tests = [...sampleTests, ...hiddenTests];
  const firstFailure = tests.find((t) => t.status !== STATUS.ACCEPTED);
  return {
    ...base,
    status: firstFailure ? firstFailure.status : STATUS.ACCEPTED,
    passed: tests.filter((t) => t.status === STATUS.ACCEPTED).length,
    tests,
  };
}
