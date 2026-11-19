import { execFileSync } from 'node:child_process';
import { loadTestEnv } from './loadTestEnv.js';

/** Runs once before all test files: creates/migrates the test database. */
export default function setup() {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, ...loadTestEnv() },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
