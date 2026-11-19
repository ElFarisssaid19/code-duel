// Prisma 7 config: https://www.prisma.io/docs/orm/reference/prisma-config-reference
// Prisma 7 no longer loads .env automatically, so load it here for the CLI.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // `npx prisma db seed` (same as `npm run db:seed`)
    seed: 'node --env-file-if-exists=.env prisma/seed/index.js',
  },
  datasource: {
    // process.env (not env()) so `prisma generate` works without a DATABASE_URL (e.g. on CI install).
    url: process.env.DATABASE_URL ?? '',
  },
});
