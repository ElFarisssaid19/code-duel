import { Router } from 'express';
import { list, show } from '../controllers/problems.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);
router.get('/', list);
router.get('/:slug', show);

export default router;
