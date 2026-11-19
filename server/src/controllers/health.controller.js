import { prisma } from '../lib/prisma.js';
import { judgeHealth } from '../services/judge/index.js';

const DB_TIMEOUT_MS = 3000;

async function checkDatabase() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${DB_TIMEOUT_MS}ms`)), DB_TIMEOUT_MS),
      ),
    ]);
    return 'ok';
  } catch (err) {
    console.error('[health] database check failed:', err.message);
    return 'error';
  }
}

/** GET /api/health: API status, a real query against MySQL, and the code runner. */
export async function getHealth(req, res) {
  const [db, judgeOk] = await Promise.all([checkDatabase(), judgeHealth()]);
  res.json({ status: 'ok', db, judge: judgeOk ? 'ok' : 'error', uptime: process.uptime() });
}
