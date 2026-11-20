import { Router } from 'express';
import { getPublicStats, PUBLIC_STATS_TTL_MS } from '../services/stats.service.js';

const router = Router();

/** GET /api/stats/public: no auth. */
router.get('/public', async (req, res) => {
  res.set('Cache-Control', `public, max-age=${PUBLIC_STATS_TTL_MS / 1000}`);
  res.json(await getPublicStats());
});

export default router;
