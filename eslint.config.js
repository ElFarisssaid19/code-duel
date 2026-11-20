import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    'server/src/generated/',
    'server/prisma/migrations/',
  ]),

  // Shared rules for all JS in the monorepo
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },

  // Node: server, root config files, client build config
  {
    files: ['server/**/*.js', '*.{js,mjs,cjs}', 'client/vite.config.js'],
    languageOptions: { globals: globals.node },
  },

  // CommonJS scripts (e.g. the judge harness that runs inside the sandbox)
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },

  // Reference solutions are user-style scripts: they define the function the judge harness calls.
  {
    files: ['server/prisma/seed/solutions/**/*.js', 'server/prisma/seed/naive/**/*.js'],
    languageOptions: { sourceType: 'script' },
    rules: { 'no-unused-vars': 'off' },
  },

  // React (browser) rules, scoped to the client
  {
    files: ['client/src/**/*.{js,jsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // Must stay last: turns off rules that conflict with Prettier
  prettier,
]);
