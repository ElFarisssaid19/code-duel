import { Router } from 'express';
import { code, preview, show } from '../controllers/matches.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.get('/:id', show);
router.get('/:id/code', code);
router.get('/:id/preview/:userId.png', preview);

export default router;
