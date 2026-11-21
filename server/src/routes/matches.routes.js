import { Router } from 'express';
import {
  code,
  createShareLink,
  getShareLink,
  preview,
  revokeShareLink,
  show,
} from '../controllers/matches.controller.js';
import { shareRateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.get('/:id', show);
router.get('/:id/code', code);
router.get('/:id/preview/:userId.png', preview);
router.get('/:id/share', getShareLink);
router.post('/:id/share', shareRateLimit, createShareLink);
router.delete('/:id/share', revokeShareLink);

export default router;
