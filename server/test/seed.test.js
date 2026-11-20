/**
 * Seed integrity against the REAL judge: every problem definition is valid, every reference
 * solution passes all its tests in both languages, and a naive O(n²) solution times out on at
 * least one hidden test of each HARD problem.
 */
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import problems, { HARD_SLUGS } from '../prisma/seed/problems/index.js';
import { validateProblem, verifyReferenceSolutions } from '../prisma/seed/verify.js';
import { judgeSolution } from '../src/services/judge/index.js';

const ORIGINAL = 8; // Phase 2 problems (≥ 6 hidden tests); the newer ones need ≥ 8.

describe('seed problems', () => {
  it('has 16 valid problems: 5 EASY, 7 MEDIUM, 4 HARD', () => {
    expect(problems).toHaveLength(16);
    const count = (d) => problems.filter((p) => p.difficulty === d).length;
    expect([count('EASY'), count('MEDIUM'), count('HARD')]).toEqual([5, 7, 4]);
    for (const p of problems) expect(validateProblem(p), p.slug).toEqual([]);
    for (const p of problems.slice(ORIGINAL)) {
      expect(
        p.tests.filter((t) => !t.hidden),
        p.slug,
      ).toHaveLength(2);
      expect(p.tests.filter((t) => t.hidden).length, p.slug).toBeGreaterThanOrEqual(8);
    }
  });

  it(
    'every reference solution passes all tests in both languages',
    { timeout: 120_000 },
    async () => {
      const failures = [];
      // A few problems at a time: go-judge runs them in parallel.
      for (let i = 0; i < problems.length; i += 4) {
        const batch = await Promise.all(
          problems.slice(i, i + 4).map((p) => verifyReferenceSolutions(p, { log: () => {} })),
        );
        failures.push(...batch.flat());
      }
      expect(failures).toEqual([]);
    },
  );

  it(
    'a naive O(n²) solution times out on at least one hidden test of each HARD problem',
    { timeout: 120_000 },
    async () => {
      const hard = problems.filter((p) => p.difficulty === 'HARD');
      expect(hard.map((p) => p.slug).sort()).toEqual([...HARD_SLUGS].sort());

      const verdicts = await Promise.all(
        hard.map(async (p) => {
          const code = await readFile(
            new URL(`../prisma/seed/naive/${p.slug}.js`, import.meta.url),
            'utf8',
          );
          return judgeSolution({
            language: 'javascript',
            code,
            functionName: p.functionName.javascript,
            timeLimitMs: p.timeLimitMs,
            tests: p.tests
              .filter((t) => t.hidden)
              .map((t) => ({ input: t.input, expected: t.expected })),
          });
        }),
      );
      for (const [i, verdict] of verdicts.entries()) {
        const statuses = verdict.tests.map((t) => t.status);
        expect(statuses, hard[i].slug).toContain('TIME_LIMIT_EXCEEDED');
        // The naive solution is correct, just slow: everything it finishes is accepted.
        expect(
          statuses.every((s) => s === 'ACCEPTED' || s === 'TIME_LIMIT_EXCEEDED'),
          hard[i].slug,
        ).toBe(true);
      }
    },
  );
});
