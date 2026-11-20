import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.ts';
import { env } from '../config/env.js';

// Prisma 7 uses driver adapters; the MariaDB adapter is the official one for MySQL.
const adapter = new PrismaMariaDb(env.DATABASE_URL);

/** Single shared Prisma client for the whole server process. */
export const prisma = new PrismaClient({
  adapter,
  // Query errors are thrown to the caller (and logged by errorHandler when they are 500s).
  // In tests, queries are also emitted as events so tests can count them (N+1 checks).
  log: env.NODE_ENV === 'test' ? [{ emit: 'event', level: 'query' }, 'warn'] : ['warn'],
});
