import { z } from 'zod';

// Variables are loaded from server/.env by Node itself (`--env-file-if-exists`, see package.json).
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_URL: z.url({ error: 'CLIENT_URL must be a valid URL, e.g. http://localhost:5173' }),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required' })
    .regex(/^mysql:\/\/.+/, 'DATABASE_URL must start with mysql://'),
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters (openssl rand -hex 64)'),
  JUDGE_URL: z.url({ error: 'JUDGE_URL must be a valid URL, e.g. http://localhost:5050' }),
  JUDGE_PROVIDER: z.enum(['gojudge']).default('gojudge'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    `\n❌ Invalid environment configuration (server/.env, or server/.env.test for tests):\n${z.prettifyError(parsed.error)}\n\n` +
      'Copy server/.env.example to server/.env and fill in the values.\n',
  );
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
});
