import { execFileSync } from 'node:child_process';
import { loadTestEnv } from './loadTestEnv.js';

/** Runs once before all test files: checks go-judge, then creates/migrates the test database. */
export default async function setup() {
  const env = loadTestEnv();

  try {
    const res = await fetch(new URL('/version', env.JUDGE_URL), {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(
      `go-judge is not reachable at ${env.JUDGE_URL} (${err.message}). Start it with \`npm run infra:up\`.`,
      { cause: err },
    );
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
