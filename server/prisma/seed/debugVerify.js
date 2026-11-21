/**
 * DEBUG problems: structural validation and verification through the real judge. Used by the
 * seed (index.js) and the test suite.
 *
 * For each language:
 *   - the BUGGY code must fail at least one sample test AND at least one hidden test. Samples and
 *     hidden tests run in separate executions, exactly like a real submission (state leaking
 *     between calls, e.g. a mutable default argument, behaves the same way);
 *   - the FIXED reference must pass every test.
 */
import { judgeSolution, LANGUAGE_IDS, STATUS } from '../../src/services/judge/index.js';
import { validateProblem } from './verify.js';

export function validateDebugProblem(p) {
  const errors = validateProblem({ ...p, starterCode: p.buggy });
  if (!Number.isInteger(p.bugCount) || p.bugCount < 1 || p.bugCount > 3) {
    errors.push('bugCount must be 1, 2 or 3');
  }
  for (const language of LANGUAGE_IDS) {
    if (!p.fixed?.[language]) errors.push(`missing fixed.${language}`);
    if (p.fixed?.[language] === p.buggy?.[language]) errors.push(`${language}: fixed === buggy`);
  }
  return errors;
}

const run = (p, language, code, tests) =>
  judgeSolution({
    language,
    code,
    functionName: p.functionName[language],
    timeLimitMs: p.timeLimitMs,
    tests: tests.map((t) => ({ input: t.input, expected: t.expected })),
  });

/** Returns { failures: string[], report: [{ language, buggy: {...}, fixed: {...} }] }. */
export async function verifyDebugProblem(p) {
  const samples = p.tests.filter((t) => !t.hidden);
  const hidden = p.tests.filter((t) => t.hidden);
  const failures = [];
  const report = [];
  for (const language of LANGUAGE_IDS) {
    const [buggySamples, buggyHidden, fixedSamples, fixedHidden] = await Promise.all([
      run(p, language, p.buggy[language], samples),
      run(p, language, p.buggy[language], hidden),
      run(p, language, p.fixed[language], samples),
      run(p, language, p.fixed[language], hidden),
    ]);
    for (const v of [buggySamples, buggyHidden, fixedSamples, fixedHidden]) {
      if (v.status === STATUS.INTERNAL_ERROR)
        failures.push(`${language}: judge error ${v.error ?? ''}`);
    }
    const line = {
      language,
      buggy: {
        samples: `${buggySamples.passed}/${buggySamples.total}`,
        hidden: `${buggyHidden.passed}/${buggyHidden.total}`,
      },
      fixed: {
        samples: `${fixedSamples.passed}/${fixedSamples.total}`,
        hidden: `${fixedHidden.passed}/${fixedHidden.total}`,
      },
    };
    report.push(line);
    if (buggySamples.passed === buggySamples.total)
      failures.push(`${language}: buggy code passes every sample test`);
    if (buggyHidden.passed === buggyHidden.total)
      failures.push(`${language}: buggy code passes every hidden test`);
    if (fixedSamples.status !== STATUS.ACCEPTED || fixedHidden.status !== STATUS.ACCEPTED) {
      failures.push(
        `${language}: fixed code fails (samples ${line.fixed.samples}, hidden ${line.fixed.hidden})` +
          (fixedSamples.compileError ?? fixedHidden.compileError ?? ''),
      );
    }
  }
  return { failures, report };
}

/** Problem row data (without slug) for a DEBUG definition. */
export function debugProblemData(p) {
  return {
    title: p.title,
    description: p.description,
    difficulty: p.difficulty,
    category: 'DEBUG',
    starterCode: p.buggy,
    bugCount: p.bugCount,
    functionName: p.functionName,
    timeLimitMs: p.timeLimitMs,
  };
}
