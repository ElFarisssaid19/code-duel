import { prisma } from '../lib/prisma.js';
import { judgeHealth } from '../services/judge/index.js';
import { rendererHealth } from '../services/renderer/index.js';

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

/** GET /api/health: API status, a real query against MySQL, the code runner and the renderer. */
export async function getHealth(req, res) {
  const [db, judgeOk, rendererOk] = await Promise.all([
    checkDatabase(),
    judgeHealth(),
    rendererHealth(),
  ]);
  res.json({
    status: 'ok',
    db,
    judge: judgeOk ? 'ok' : 'error',
    renderer: rendererOk ? 'ok' : 'error',
    uptime: process.uptime(),
  });
}
