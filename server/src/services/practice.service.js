import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { judgeSolution, judgeSubmission, JudgeUnavailableError, STATUS } from './judge/index.js';
import { submitFrontendPractice } from './frontend/practice.js';
import { toPublicResult } from './judge/publicResult.js';
import { frontendProblemSelect } from './problem.service.js';

/** Judges code (run: samples only; submit: samples + hidden in separate executions). */
export async function judgeCode({ mode, language, code, functionName, timeLimitMs, testCases }) {
  const tests = testCases.map((t) => ({
    input: t.input,
    expected: t.expectedOutput,
    hidden: t.isHidden,
  }));
  const options = { language, code, functionName, timeLimitMs };
  let verdict;
  try {
    verdict =
      mode === 'submit'
        ? await judgeSubmission({ ...options, tests })
        : await judgeSolution({ ...options, tests: tests.filter((t) => !t.hidden) });
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
    console.error('[judge] internal error:', verdict.error ?? 'no details');
    throw new HttpError(503, 'JUDGE_ERROR', 'The code runner failed to run your code. Try again.');
  }
  return verdict;
}

/**
 * FRONTEND practice: POST /api/practice/:slug/submit with { html, css }. There is no "run" (the
 * client has a live preview). Returns { score, solved, threshold, charCount, diffImage, submission }.
 */
async function frontendPractice({ userId, slug, mode, html, css }) {
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: { ...frontendProblemSelect, category: true },
  });
  if (!problem) throw new HttpError(404, 'NOT_FOUND', 'Problem not found');
  if (problem.category !== 'FRONTEND') {
    throw new HttpError(
      400,
      'WRONG_CATEGORY',
      'This is an algorithm problem: send { language, code }.',
    );
  }
  if (mode !== 'submit') {
    throw new HttpError(
      400,
      'NOT_SUPPORTED',
      'Frontend problems have no run step: use the live preview, then submit.',
    );
  }
  return submitFrontendPractice({ userId, problem, html, css });
}

/**
 * Judges code for a problem. mode "run": sample tests only. mode "submit": all tests, and the
 * result is saved as a practice Submission (matchId null). FRONTEND payloads ({ kind:
 * 'frontend', html, css }) go to frontendPractice().
 */
export async function judgePractice({ userId, slug, language, code, mode, kind, html, css }) {
  if (kind === 'frontend') return frontendPractice({ userId, slug, mode, html, css });
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: {
      category: true,
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
  if (problem.category === 'FRONTEND') {
    throw new HttpError(400, 'WRONG_CATEGORY', 'This is a frontend problem: send { html, css }.');
  }

  const functionName = problem.functionName?.[language];
  if (!functionName) {
    throw new HttpError(400, 'UNSUPPORTED_LANGUAGE', `This problem has no ${language} version`);
  }

  const verdict = await judgeCode({
    mode,
    language,
    code,
    functionName,
    timeLimitMs: problem.timeLimitMs,
    testCases: problem.testCases,
  });

  const result = toPublicResult(mode, verdict);
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
