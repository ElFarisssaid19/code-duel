/**
 * Seeds the problems: `npm run db:seed` (idempotent, upserts by slug).
 *
 * ALGO: every reference solution (solutions/<slug>.{js,py}) is run through the real judge
 * against ALL of its problem's tests.
 * FRONTEND: every reference solution is rendered by the renderer service into the problem's
 * target image (<DATA_DIR>/targets/<slug>.png) and must score 100.00 against it, while an empty
 * page and the starter code must score clearly lower.
 * If any check fails, nothing is written. Requires `npm run infra:up` (MySQL, go-judge, renderer).
 */
import { prisma } from '../../src/lib/prisma.js';
import { targetImagePathFor, writeTarget } from '../../src/services/frontend/targets.js';
import { judgeHealth } from '../../src/services/judge/index.js';
import { rendererHealth } from '../../src/services/renderer/index.js';
import frontendProblems from './frontend/index.js';
import {
  buildAndVerifyTarget,
  frontendProblemData,
  validateFrontendProblem,
} from './frontendVerify.js';
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

async function upsertFrontendProblem(problem) {
  const data = frontendProblemData(problem);
  await prisma.$transaction(async (tx) => {
    const { id } = await tx.problem.upsert({
      where: { slug: problem.slug },
      create: { slug: problem.slug, ...data },
      update: data,
      select: { id: true },
    });
    await tx.testCase.deleteMany({ where: { problemId: id } });
  });
}

async function main() {
  const invalid = [
    ...problems.flatMap((p) => validateProblem(p).map((e) => `${p.slug}: ${e}`)),
    ...frontendProblems.flatMap((p) => validateFrontendProblem(p).map((e) => `${p.slug}: ${e}`)),
  ];
  if (invalid.length) throw new Error(`Invalid problem definitions:\n- ${invalid.join('\n- ')}`);
  const slugs = [...problems, ...frontendProblems].map((p) => p.slug);
  const duplicate = slugs.find((slug, i) => slugs.indexOf(slug) !== i);
  if (duplicate) throw new Error(`Duplicate problem slug: ${duplicate}`);

  if (!(await judgeHealth())) {
    throw new Error('go-judge is not reachable. Start the infrastructure with `npm run infra:up`.');
  }
  if (!(await rendererHealth())) {
    throw new Error(
      'The renderer is not reachable. Start the infrastructure with `npm run infra:up`.',
    );
  }

  console.log(`Verifying reference solutions for ${problems.length} problems…`);
  const failures = [];
  for (const problem of problems) {
    console.log(`${problem.slug} (${problem.tests.length} tests)`);
    for (const failure of await verifyReferenceSolutions(problem)) {
      failures.push(`${problem.slug} / ${failure}`);
    }
  }

  console.log(`\nRendering and verifying ${frontendProblems.length} frontend targets…`);
  const targets = new Map();
  for (const problem of frontendProblems) {
    const { png, failures: problemFailures, scores } = await buildAndVerifyTarget(problem);
    console.log(
      `${problem.slug.padEnd(26)} ${problem.track.padEnd(8)} reference ${scores.reference.toFixed(2)}` +
        `  blank ${scores.blank.toFixed(2)}  starter ${scores.starter.toFixed(2)}`,
    );
    targets.set(problem.slug, png);
    for (const failure of problemFailures) failures.push(`${problem.slug} / ${failure}`);
  }

  if (failures.length) {
    throw new Error(`Reference solutions failed, nothing was written:\n\n${failures.join('\n\n')}`);
  }

  for (const problem of problems) await upsertProblem(problem);
  for (const problem of frontendProblems) {
    await writeTarget(targetImagePathFor(problem.slug), targets.get(problem.slug));
    await upsertFrontendProblem(problem);
  }
  console.log(
    `\n✔ Seeded ${problems.length} algorithm problems (all reference solutions passed) and ` +
      `${frontendProblems.length} frontend problems (all references score 100.00).`,
  );
}

try {
  await main();
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
