import { Router } from 'express';
import { leaderboard } from '../controllers/leaderboard.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.get('/', leaderboard);

export default router;
