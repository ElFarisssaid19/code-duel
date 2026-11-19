import { readFileSync } from 'node:fs';
import { LANGUAGES } from './languages.js';

/** File the harness writes one JSON record per line to; collected after the run. */
export const RESULTS_FILE = 'results.jsonl';
/** User console output kept per test case (the rest is truncated). */
export const MAX_LOG_BYTES_PER_TEST = 4 * 1024;

const harnessSource = (file) => readFileSync(new URL(`./harness/${file}`, import.meta.url), 'utf8');
const HARNESS_SOURCES = {
  javascript: harnessSource('javascript.cjs'),
  python: harnessSource('python.py'),
};

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Builds what goes into the sandbox for one function-style run: the harness (entry file),
 * the user's code, and stdin with the test inputs.
 *
 * SECURITY: only the inputs enter the sandbox. Expected outputs never leave the server;
 * evaluate.js compares them after the run.
 */
export function buildHarnessRun({
  language,
  code,
  functionName,
  inputs,
  timeLimitMs,
  captureLogs = true,
}) {
  const lang = LANGUAGES[language];
  if (!lang) throw new Error(`Unsupported language: ${language}`);
  if (!IDENTIFIER.test(functionName)) throw new Error(`Invalid function name: ${functionName}`);

  return {
    files: {
      [lang.entryFile]: HARNESS_SOURCES[language],
      [lang.solutionFile]: code,
    },
    // Passed on stdin (not as a file): the harness reads it completely before loading user code.
    stdin: JSON.stringify({
      functionName,
      timeLimitMs,
      // 0 = user console output is discarded inside the sandbox (hidden-test runs).
      maxLogBytes: captureLogs ? MAX_LOG_BYTES_PER_TEST : 0,
      resultsFile: RESULTS_FILE,
      tests: inputs,
    }),
    collectFiles: [RESULTS_FILE],
  };
}
