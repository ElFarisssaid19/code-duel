/**
 * Seeds the practice problems: `npm run db:seed` (idempotent, upserts by slug).
 *
 * Before writing anything, every reference solution (solutions/<slug>.{js,py}) is run through
 * the real judge against ALL of its problem's tests. If any fails, nothing is written.
 * Requires the infra to be up (MySQL + go-judge: `npm run infra:up`).
 */
import { prisma } from '../../src/lib/prisma.js';
import { judgeHealth } from '../../src/services/judge/index.js';
import problems from './problems/index.js';
import { validateProblem, verifyReferenceSolutions } from './verify.js';

async function upsertProblem(problem) {
  const data = {
    title: problem.title,
    description: problem.description,
    difficulty: problem.difficulty,
    starterCode: problem.starterCode,
    functionName: problem.functionName,
    timeLimitMs: problem.timeLimitMs,
  };
  await prisma.$transaction(async (tx) => {
    const { id } = await tx.problem.upsert({
      where: { slug: problem.slug },
      create: { slug: problem.slug, ...data },
      update: data,
      select: { id: true },
    });
    await tx.testCase.deleteMany({ where: { problemId: id } });
    await tx.testCase.createMany({
      data: problem.tests.map((t, order) => ({
        problemId: id,
        order,
        input: t.input,
        expectedOutput: t.expected,
        isHidden: Boolean(t.hidden),
      })),
    });
  });
}

async function main() {
  const invalid = problems.flatMap((p) => validateProblem(p).map((e) => `${p.slug}: ${e}`));
  if (invalid.length) throw new Error(`Invalid problem definitions:\n- ${invalid.join('\n- ')}`);

  if (!(await judgeHealth())) {
    throw new Error('go-judge is not reachable. Start the infrastructure with `npm run infra:up`.');
  }

  console.log(`Verifying reference solutions for ${problems.length} problems…`);
  const failures = [];
  for (const problem of problems) {
    console.log(`${problem.slug} (${problem.tests.length} tests)`);
    for (const failure of await verifyReferenceSolutions(problem)) {
      failures.push(`${problem.slug} / ${failure}`);
    }
  }
  if (failures.length) {
    throw new Error(`Reference solutions failed, nothing was written:\n\n${failures.join('\n\n')}`);
  }

  for (const problem of problems) await upsertProblem(problem);
  console.log(`\n✔ Seeded ${problems.length} problems (all reference solutions passed).`);
}

try {
  await main();
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
