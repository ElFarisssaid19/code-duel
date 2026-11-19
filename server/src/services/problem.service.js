import { HttpError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

/** All problems with a `solved` flag for the given user (an ACCEPTED practice or match submission). */
export async function listProblems(userId) {
  const [problems, solved] = await Promise.all([
    prisma.problem.findMany({
      select: { id: true, slug: true, title: true, difficulty: true },
      orderBy: [{ difficulty: 'asc' }, { id: 'asc' }],
    }),
    prisma.submission.findMany({
      where: { userId, status: 'ACCEPTED' },
      select: { problemId: true },
      distinct: ['problemId'],
    }),
  ]);
  const solvedIds = new Set(solved.map((s) => s.problemId));
  return problems.map((p) => ({ ...p, solved: solvedIds.has(p.id) }));
}

/** Problem statement + sample tests. Hidden tests are never loaded from the database here. */
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
      testCases: {
        where: { isHidden: false },
        orderBy: { order: 'asc' },
        select: { input: true, expectedOutput: true },
      },
    },
  });
  if (!problem) throw new HttpError(404, 'NOT_FOUND', 'Problem not found');

  const { testCases, ...rest } = problem;
  return {
    ...rest,
    samples: testCases.map((t, index) => ({ index, input: t.input, expected: t.expectedOutput })),
  };
}
