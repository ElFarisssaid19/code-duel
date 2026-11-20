/**
 * Problem validation and reference-solution verification through the real judge. Used by the
 * seed (index.js) and by the test suite (test/seed.test.js).
 */
import { readFile } from 'node:fs/promises';
import { judgeSolution, LANGUAGE_IDS, STATUS } from '../../src/services/judge/index.js';

export const SOLUTION_EXTENSIONS = { javascript: 'js', python: 'py' };
const MIN_SAMPLES = 2;
/** Phase 2 problems have at least 6 hidden tests; newer ones at least 8. */
const MIN_HIDDEN = 6;

/** Structural checks so a malformed problem fails loudly instead of seeding bad data. */
export function validateProblem(problem) {
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

export async function verifyReferenceSolutions(problem, { log = console.log } = {}) {
  const results = await Promise.all(
    LANGUAGE_IDS.map((language) => verifyOne(problem, language, log)),
  );
  return results.flat();
}

async function verifyOne(problem, language, log) {
  const failures = [];
  {
    const file = new URL(
      `./solutions/${problem.slug}.${SOLUTION_EXTENSIONS[language]}`,
      import.meta.url,
    );
    const code = await readFile(file, 'utf8').catch(() => null);
    if (code === null) {
      failures.push(`${language}: missing reference solution ${file.pathname}`);
      return failures;
    }

    const verdict = await judgeSolution({
      language,
      code,
      functionName: problem.functionName[language],
      timeLimitMs: problem.timeLimitMs,
      tests: problem.tests.map((t) => ({ input: t.input, expected: t.expected })),
    });
    const status = `${verdict.status} ${verdict.passed}/${verdict.total}`;
    log(`  ${language.padEnd(10)} ${status.padEnd(28)} ${verdict.timeMs} ms`);

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
