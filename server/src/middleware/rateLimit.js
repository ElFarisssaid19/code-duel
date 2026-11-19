import { MemoryStore, rateLimit } from 'express-rate-limit';
import { HttpError } from '../lib/errors.js';

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 10;
const stores = [];

/** 10 requests / 15 min per IP. Each limiter has its own in-memory store. */
function authLimiter() {
  const store = new MemoryStore();
  stores.push(store);
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: LIMIT,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store,
    handler: (req, res, next) =>
      next(
        new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Please try again in a few minutes.'),
      ),
  });
}

export const loginRateLimit = authLimiter();
export const registerRateLimit = authLimiter();

/** Clears all auth rate-limit counters (used by tests). */
export async function resetRateLimits() {
  await Promise.all(stores.map((s) => s.resetAll()));
}
