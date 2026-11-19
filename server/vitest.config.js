import { defineConfig } from 'vitest/config';
import { loadTestEnv } from './test/loadTestEnv.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    env: loadTestEnv(),
    globalSetup: ['test/globalSetup.js'],
    setupFiles: ['test/setup.js'],
    // All test files share one database, so run them one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 60_000,
  },
});
