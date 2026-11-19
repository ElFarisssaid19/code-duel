import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.ts';
import { env } from '../config/env.js';

// Prisma 7 uses driver adapters; the MariaDB adapter is the official one for MySQL.
const adapter = new PrismaMariaDb(env.DATABASE_URL);

/** Single shared Prisma client for the whole server process. */
export const prisma = new PrismaClient({
  adapter,
  log: env.isDev ? ['warn', 'error'] : ['error'],
});
