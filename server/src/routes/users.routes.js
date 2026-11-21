import { Router } from 'express';
import { eloHistory, matches, opponents, profile } from '../controllers/users.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.get('/:username/profile', profile);
router.get('/:username/elo-history', eloHistory);
router.get('/:username/matches', matches);
router.get('/:username/opponents', opponents);

export default router;
