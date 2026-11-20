import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { resetRateLimits } from '../src/middleware/rateLimit.js';

/** Deletes all rows, children before parents (foreign keys). */
export async function resetDatabase() {
  await prisma.$transaction([
    prisma.submission.deleteMany(),
    prisma.match.deleteMany(),
    prisma.testCase.deleteMany(),
    prisma.problem.deleteMany(),
    prisma.userRating.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

beforeEach(async () => {
  await resetDatabase();
  await resetRateLimits();
});

afterAll(async () => {
  await prisma.$disconnect();
});
