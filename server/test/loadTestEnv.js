import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const ENV_FILE = new URL('../.env.test', import.meta.url);

/** Reads server/.env.test and refuses to run against a non-test database. */
export function loadTestEnv() {
  if (!existsSync(ENV_FILE)) {
    throw new Error(
      'server/.env.test is missing. Run: cp server/.env.test.example server/.env.test',
    );
  }
  const env = parseEnv(readFileSync(ENV_FILE, 'utf8'));

  const dbName = new URL(env.DATABASE_URL ?? 'mysql://x/').pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests: DATABASE_URL in .env.test points to "${dbName}". ` +
        'Tests wipe every table, so the database name must end in "_test".',
    );
  }
  return env;
}
