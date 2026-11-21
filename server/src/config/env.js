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
  /** HTML/CSS renderer for FRONTEND problems (infra/renderer). Not 5060/5061: fetch() blocks them. */
  RENDERER_URL: z
    .url({ error: 'RENDERER_URL must be a valid URL, e.g. http://localhost:5070' })
    .default('http://localhost:5070'),
  RENDERER_PROVIDER: z.enum(['playwright']).default('playwright'),
  /** Public URL of the app (share links and Open Graph tags need absolute URLs). */
  APP_URL: z
    .url({ error: 'APP_URL must be a valid URL, e.g. https://codeduel.example.com' })
    .default('http://localhost:5173'),
  /** Where the seed writes FRONTEND target images and share cards are cached (relative to server/ or absolute). */
  DATA_DIR: z.string().default('data'),
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
