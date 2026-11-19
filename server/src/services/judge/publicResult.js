/**
 * What a client may see of a verdict (practice and duels). Sample tests: full details.
 * Hidden tests: only { index, status, timeMs }. judgeSubmission already ran them in a separate
 * execution and stripped everything else; this is a second line of defence.
 */
export function toPublicResult(mode, verdict) {
  return {
    mode,
    status: verdict.status,
    passed: verdict.passed,
    total: verdict.total,
    timeMs: verdict.timeMs,
    memoryKb: verdict.memoryKb,
    compileError: verdict.compileError ?? null,
    tests: verdict.tests.map((t) =>
      t.hidden
        ? { index: t.index, status: t.status, timeMs: t.timeMs }
        : {
            index: t.index,
            status: t.status,
            input: t.input,
            expected: t.expected,
            actual: t.actual,
            error: t.error,
            logs: t.logs,
            timeMs: t.timeMs,
          },
    ),
  };
}
