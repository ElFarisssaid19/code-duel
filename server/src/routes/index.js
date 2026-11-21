import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import matchRoutes from './matches.routes.js';
import practiceRoutes from './practice.routes.js';
import problemRoutes from './problems.routes.js';
import settingsRoutes from './settings.routes.js';
import { shareApiRouter } from './share.routes.js';
import statsRoutes from './stats.routes.js';
import userRoutes from './users.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/problems', problemRoutes);
router.use('/practice', practiceRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/users', userRoutes);
router.use('/matches', matchRoutes);
router.use('/settings', settingsRoutes);
router.use('/stats', statsRoutes);
router.use('/share', shareApiRouter);

export default router;
