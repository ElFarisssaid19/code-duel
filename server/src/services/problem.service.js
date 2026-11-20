import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { publicFrontendProblem } from './frontend/publicProblem.js';

/**
 * Problems of a category (default ALGO) with a `solved` flag for the given user (an ACCEPTED
 * practice or match submission). FRONTEND items also have `track` and `bestScore` (the user's
 * best score, null if never submitted).
 */
export async function listProblems(userId, { category = 'ALGO', track } = {}) {
  const [problems, solved, best] = await Promise.all([
    prisma.problem.findMany({
      where: { category, ...(track && { track }) },
      select: { id: true, slug: true, title: true, difficulty: true, track: true },
      orderBy: [{ difficulty: 'asc' }, { id: 'asc' }],
    }),
    prisma.submission.findMany({
      where: { userId, status: 'ACCEPTED' },
      select: { problemId: true },
      distinct: ['problemId'],
    }),
    category === 'FRONTEND'
      ? prisma.submission.groupBy({
          by: ['problemId'],
          where: { userId, score: { not: null } },
          _max: { score: true },
        })
      : [],
  ]);
  const solvedIds = new Set(solved.map((s) => s.problemId));
  const bestScores = new Map(best.map((b) => [b.problemId, Number(b._max.score)]));
  return problems.map(({ track: problemTrack, ...p }) => ({
    ...p,
    solved: solvedIds.has(p.id),
    ...(category === 'FRONTEND' && {
      track: problemTrack,
      bestScore: bestScores.get(p.id) ?? null,
    }),
  }));
}

export const frontendProblemSelect = {
  id: true,
  slug: true,
  title: true,
  difficulty: true,
  description: true,
  starterCode: true,
  track: true,
  canvasWidth: true,
  canvasHeight: true,
  fixedHtml: true,
  palette: true,
  matchThreshold: true,
  targetImagePath: true,
};

/**
 * Problem statement + sample tests (ALGO) or the FRONTEND brief (target image URL, canvas,
 * palette, track rules). Hidden tests and reference solutions are never loaded here.
 */
export async function getProblemBySlug(slug) {
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      description: true,
      starterCode: true,
      timeLimitMs: true,
      category: true,
      testCases: {
        where: { isHidden: false },
        orderBy: { order: 'asc' },
        select: { input: true, expectedOutput: true },
      },
    },
  });
  if (!problem) throw new HttpError(404, 'NOT_FOUND', 'Problem not found');

  if (problem.category === 'FRONTEND') {
    const full = await prisma.problem.findUnique({
      where: { slug },
      select: frontendProblemSelect,
    });
    return publicFrontendProblem(full);
  }
  const { testCases, category: _category, ...rest } = problem;
  return {
    ...rest,
    samples: testCases.map((t, index) => ({ index, input: t.input, expected: t.expectedOutput })),
  };
}

/** Path of a FRONTEND problem's target PNG (relative to the data dir), or 404. */
export async function getTargetImagePath(slug) {
  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: { category: true, targetImagePath: true },
  });
  if (problem?.category !== 'FRONTEND' || !problem.targetImagePath) {
    throw new HttpError(404, 'NOT_FOUND', 'Target image not found');
  }
  return problem.targetImagePath;
}
