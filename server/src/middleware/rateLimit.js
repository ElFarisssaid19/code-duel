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

/** Clears all rate-limit counters (used by tests). */
export async function resetRateLimits() {
  await Promise.all(stores.map((s) => s.resetAll()));
}
