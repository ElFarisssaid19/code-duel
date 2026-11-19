import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { judgeSolution, JudgeUnavailableError, STATUS } from './judge/index.js';

/**
 * What the client may see of a verdict. Sample tests: full details. Hidden tests: only
 * { index, status, timeMs }, never input/expected/actual/logs/error (logs or error messages
 * could echo the hidden input).
 */
function toPublicResult(mode, verdict, testCases) {
  return {
    mode,
    status: verdict.status,
    passed: verdict.passed,
    total: verdict.total,
    timeMs: verdict.timeMs,
    memoryKb: verdict.memoryKb,
    compileError: verdict.compileError ?? null,
    tests: verdict.tests.map((t, i) =>
      testCases[i].isHidden
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

/**
 * Judges code for a problem. mode "run": sample tests only. mode "submit": all tests, and the
 * result is saved as a practice Submission (matchId null).
 */
export async function judgePractice({ userId, slug, language, code, mode }) {
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: {
      id: true,
      functionName: true,
      timeLimitMs: true,
      testCases: {
        where: mode === 'run' ? { isHidden: false } : {},
        orderBy: { order: 'asc' },
        select: { input: true, expectedOutput: true, isHidden: true },
      },
    },
  });
  if (!problem) throw new HttpError(404, 'NOT_FOUND', 'Problem not found');

  const functionName = problem.functionName?.[language];
  if (!functionName) {
    throw new HttpError(400, 'UNSUPPORTED_LANGUAGE', `This problem has no ${language} version`);
  }

  let verdict;
  try {
    verdict = await judgeSolution({
      language,
      code,
      functionName,
      timeLimitMs: problem.timeLimitMs,
      tests: problem.testCases.map((t) => ({ input: t.input, expected: t.expectedOutput })),
    });
  } catch (err) {
    if (err instanceof JudgeUnavailableError) {
      console.error('[judge]', err.message);
      throw new HttpError(
        503,
        'JUDGE_UNAVAILABLE',
        'The code runner is unavailable. Try again in a moment.',
      );
    }
    throw err;
  }
  if (verdict.status === STATUS.INTERNAL_ERROR) {
    console.error(
      '[judge] internal error:',
      verdict.error ?? verdict.tests.find((t) => t.error)?.error,
    );
    throw new HttpError(503, 'JUDGE_ERROR', 'The code runner failed to run your code. Try again.');
  }

  const result = toPublicResult(mode, verdict, problem.testCases);
  if (mode !== 'submit') return { result };

  const submission = await prisma.submission.create({
    data: {
      userId,
      problemId: problem.id,
      matchId: null,
      language,
      code,
      status: verdict.status,
      passed: verdict.passed,
      total: verdict.total,
      timeMs: verdict.timeMs,
    },
    select: { id: true, status: true, passed: true, total: true, createdAt: true },
  });
  return { result, submission };
}
