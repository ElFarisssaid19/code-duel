import { Router } from 'express';
import { login, logout, me, register } from '../controllers/auth.controller.js';
import { loginRateLimit, registerRateLimit } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.schemas.js';

const router = Router();

// Auth responses are per-user and sensitive: never cache them (also disables 304s on /me).
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/register', registerRateLimit, validateBody(registerSchema), register);
router.post('/login', loginRateLimit, validateBody(loginSchema), login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
