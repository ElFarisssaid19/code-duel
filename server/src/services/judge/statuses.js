/** Verdicts produced by the judge. The first seven also exist as the Prisma SubmissionStatus enum. */
export const STATUS = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  WRONG_ANSWER: 'WRONG_ANSWER',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  COMPILE_ERROR: 'COMPILE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Per-test only: the test never ran because the process was killed on an earlier test. */
  SKIPPED: 'SKIPPED',
});
