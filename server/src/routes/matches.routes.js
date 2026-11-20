import { Router } from 'express';
import { code, show } from '../controllers/matches.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.get('/:id', show);
router.get('/:id/code', code);

export default router;
