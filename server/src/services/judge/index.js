/**
 * Judge service entry point. Picks the provider from env JUDGE_PROVIDER (default "gojudge").
 *
 * Provider interface (see providers/gojudge.js):
 *   runCode({ language, files, stdin, timeLimitMs, memoryLimitMb, collectFiles? })
 *     → { status, message, stdout, stderr, timeMs, memoryKb, exitCode, files }
 *   health() → boolean
 * To add an engine, implement that interface in providers/<name>.js and register it below.
 */
import { env } from '../../config/env.js';
import { evaluateSolution } from './evaluate.js';
import { createGoJudgeProvider } from './providers/gojudge.js';

export { JudgeUnavailableError } from './errors.js';
export { LANGUAGE_IDS, LANGUAGES } from './languages.js';
export { STATUS } from './statuses.js';

export const DEFAULT_MEMORY_LIMIT_MB = 256;

const PROVIDERS = {
  gojudge: () => createGoJudgeProvider({ baseUrl: env.JUDGE_URL }),
};

let provider;
export function getJudge() {
  provider ??= PROVIDERS[env.JUDGE_PROVIDER]();
  return provider;
}

export const runCode = (options) =>
  getJudge().runCode({ memoryLimitMb: DEFAULT_MEMORY_LIMIT_MB, ...options });

export const judgeHealth = () => getJudge().health();

/** Runs a function-style solution against test cases. See evaluate.js. */
export const judgeSolution = (options) =>
  evaluateSolution({ memoryLimitMb: DEFAULT_MEMORY_LIMIT_MB, ...options, runCode });
