import { Router } from 'express';
import { logoutAll, password, preferences } from '../controllers/settings.controller.js';
import { passwordChangeRateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';
import { changePasswordSchema, preferencesSchema } from '../validators/settings.schemas.js';

const router = Router();

// Per-user, never cached.
router.use(requireAuth, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.post('/password', passwordChangeRateLimit, validateBody(changePasswordSchema), password);
router.post('/logout-all', logoutAll);
router.patch('/preferences', validateBody(preferencesSchema), preferences);

export default router;
