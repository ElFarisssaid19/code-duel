import { MemoryStore, rateLimit } from 'express-rate-limit';
import { HttpError } from '../lib/errors.js';

const stores = [];

function limiter({ windowMs, limit, message, keyGenerator }) {
  const store = new MemoryStore();
  stores.push(store);
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store,
    ...(keyGenerator && { keyGenerator }),
    handler: (req, res, next) => next(new HttpError(429, 'RATE_LIMITED', message)),
  });
}

/** Login / register: 10 requests per 15 minutes per IP (each route counts separately). */
const authLimiter = () =>
  limiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: 'Too many attempts. Please try again in a few minutes.',
  });

export const loginRateLimit = authLimiter();
export const registerRateLimit = authLimiter();

/** Code execution (run + submit together): 1 request per 3 seconds per user. Needs requireAuth. */
export const practiceRateLimit = limiter({
  windowMs: 3000,
  limit: 1,
  message: 'You can run code once every 3 seconds. Please wait a moment.',
  keyGenerator: (req) => `user:${req.user.id}`,
});

/** Password changes: 5 attempts per 15 minutes per user (needs requireAuth). */
export const passwordChangeRateLimit = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Too many password change attempts. Please try again in a few minutes.',
  keyGenerator: (req) => `user:${req.user.id}`,
});

/** Share links (each one renders a card): 10 per 10 minutes per user. Needs requireAuth. */
export const shareRateLimit = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  message: 'Too many share cards created. Please try again in a few minutes.',
  keyGenerator: (req) => `user:${req.user.id}`,
});

/** Public share pages and card images (cached, but a miss renders a card): 120 per minute per IP. */
export const publicShareRateLimit = limiter({
  windowMs: 60 * 1000,
  limit: 120,
  message: 'Too many requests. Please slow down.',
});

/** Clears all rate-limit counters (used by tests). */
export async function resetRateLimits() {
  await Promise.all(stores.map((s) => s.resetAll()));
}
