/**
 * Seeds the practice problems: `npm run db:seed` (idempotent, upserts by slug).
 *
 * Before writing anything, every reference solution (solutions/<slug>.{js,py}) is run through
 * the real judge against ALL of its problem's tests. If any fails, nothing is written.
 * Requires the infra to be up (MySQL + go-judge: `npm run infra:up`).
 */
import { readFile } from 'node:fs/promises';
import { prisma } from '../../src/lib/prisma.js';
import {
  judgeHealth,
  judgeSolution,
  LANGUAGE_IDS,
  STATUS,
} from '../../src/services/judge/index.js';
import problems from './problems/index.js';

const SOLUTION_EXTENSIONS = { javascript: 'js', python: 'py' };
const MIN_SAMPLES = 2;
const MIN_HIDDEN = 6;

/** Structural checks so a malformed problem fails loudly instead of seeding bad data. */
function validateProblem(problem) {
  const errors = [];
  const samples = problem.tests.filter((t) => !t.hidden);
  const hidden = problem.tests.filter((t) => t.hidden);
  if (samples.length < MIN_SAMPLES) errors.push(`needs at least ${MIN_SAMPLES} sample tests`);
  if (hidden.length < MIN_HIDDEN) errors.push(`needs at least ${MIN_HIDDEN} hidden tests`);
  if (problem.tests.findIndex((t) => t.hidden) < samples.length) {
    errors.push('sample tests must come before hidden tests');
  }
  for (const language of LANGUAGE_IDS) {
    if (!problem.functionName?.[language]) errors.push(`missing functionName.${language}`);
    if (!problem.starterCode?.[language]) errors.push(`missing starterCode.${language}`);
  }
  problem.tests.forEach((t, i) => {
    if (!Array.isArray(t.input)) errors.push(`test ${i}: input must be an array of arguments`);
    if (t.expected === undefined || t.expected === null) errors.push(`test ${i}: missing expected`);
  });
  return errors;
}

async function verifyReferenceSolutions(problem) {
  const failures = [];
  for (const language of LANGUAGE_IDS) {
    const file = new URL(
      `./solutions/${problem.slug}.${SOLUTION_EXTENSIONS[language]}`,
      import.meta.url,
    );
    const code = await readFile(file, 'utf8').catch(() => null);
    if (code === null) {
      failures.push(`${language}: missing reference solution ${file.pathname}`);
      continue;
    }

    const verdict = await judgeSolution({
      language,
      code,
      functionName: problem.functionName[language],
      timeLimitMs: problem.timeLimitMs,
      tests: problem.tests.map((t) => ({ input: t.input, expected: t.expected })),
    });
    const status = `${verdict.status} ${verdict.passed}/${verdict.total}`;
    console.log(`  ${language.padEnd(10)} ${status.padEnd(28)} ${verdict.timeMs} ms`);

    if (verdict.status !== STATUS.ACCEPTED) {
      const failed = verdict.tests.find((t) => t.status !== STATUS.ACCEPTED);
      const detail = verdict.compileError
        ? verdict.compileError
        : `test #${failed.index}: ${failed.status}` +
          (failed.error ? `\n${failed.error}` : '') +
          (failed.status === STATUS.WRONG_ANSWER
            ? `\nexpected ${JSON.stringify(failed.expected).slice(0, 300)}` +
              `\nactual   ${JSON.stringify(failed.actual).slice(0, 300)}`
            : '');
      failures.push(`${language}: ${status}\n${detail}`);
    }
  }
  return failures;
}

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
