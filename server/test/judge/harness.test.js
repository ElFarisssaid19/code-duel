import { describe, expect, it } from 'vitest';
import {
  buildHarnessRun,
  MAX_LOG_BYTES_PER_TEST,
  RESULTS_FILE,
} from '../../src/services/judge/harness.js';

const inputs = [
  [[2, 7, 11, 15], 9],
  [[3, 2, 4], 6],
];

describe('buildHarnessRun', () => {
  it.each([
    ['javascript', 'main.js', 'solution.js', "require('node:vm')"],
    ['python', 'main.py', 'solution.py', 'def main():'],
  ])('wraps %s code with the harness', (language, entry, solution, harnessMarker) => {
    const code = '// user code';
    const run = buildHarnessRun({
      language,
      code,
      functionName: 'twoSum',
      inputs,
      timeLimitMs: 1500,
    });

    expect(Object.keys(run.files).sort()).toEqual([entry, solution].sort());
    expect(run.files[solution]).toBe(code);
    expect(run.files[entry]).toContain(harnessMarker);
    expect(run.files[entry]).toContain('TODO(security)');
    expect(run.collectFiles).toEqual([RESULTS_FILE]);
  });

  it('puts only inputs and settings on stdin, never expected outputs', () => {
    const run = buildHarnessRun({
      language: 'python',
      code: 'x',
      functionName: 'two_sum',
      inputs,
      timeLimitMs: 1500,
    });

    expect(JSON.parse(run.stdin)).toEqual({
      functionName: 'two_sum',
      timeLimitMs: 1500,
      maxLogBytes: MAX_LOG_BYTES_PER_TEST,
      resultsFile: RESULTS_FILE,
      tests: inputs,
    });
    expect(run.stdin).not.toMatch(/expected/i);
  });

  it('turns console capture off for hidden-test runs', () => {
    const run = buildHarnessRun({
      language: 'javascript',
      code: 'x',
      functionName: 'f',
      inputs,
      timeLimitMs: 1000,
      captureLogs: false,
    });
    expect(JSON.parse(run.stdin).maxLogBytes).toBe(0);
  });

  it('rejects unsupported languages and unsafe function names', () => {
    const base = { code: 'x', inputs, timeLimitMs: 1000 };
    expect(() => buildHarnessRun({ ...base, language: 'ruby', functionName: 'f' })).toThrow(
      /Unsupported language/,
    );
    expect(() =>
      buildHarnessRun({ ...base, language: 'javascript', functionName: 'f(); process.exit()' }),
    ).toThrow(/Invalid function name/);
  });
});
