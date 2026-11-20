import { Router } from 'express';
import { run, submit } from '../controllers/practice.controller.js';
import { practiceRateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';
import { codeSubmissionSchema } from '../validators/practice.schemas.js';

const router = Router();

router.use(requireAuth);
// Run and submit share one limiter: 1 execution per 3 seconds per user.
router.post('/:slug/run', validateBody(codeSubmissionSchema), practiceRateLimit, run);
router.post('/:slug/submit', validateBody(codeSubmissionSchema), practiceRateLimit, submit);

export default router;
