import { prisma } from '../lib/prisma.js';

const DB_TIMEOUT_MS = 3000;

/** GET /api/health: reports API status and runs a real query against MySQL. */
export async function getHealth(req, res) {
  let db = 'ok';
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${DB_TIMEOUT_MS}ms`)), DB_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    db = 'error';
    console.error('[health] database check failed:', err.message);
  }

  res.json({ status: 'ok', db, uptime: process.uptime() });
}
