import { z } from 'zod';
import { CATEGORIES, TRACKS } from '../lib/ratings.js';

export const categorySchema = z.enum(CATEGORIES, { error: 'category must be ALGO or FRONTEND' });
export const trackSchema = z.enum(TRACKS, { error: 'track must be HTML, CSS or HTML_CSS' });
const category = categorySchema.default('ALGO');

const page = z.coerce
  .number({ error: 'page must be a number' })
  .int()
  .min(1, 'page must be at least 1')
  .default(1);

export const leaderboardQuerySchema = z.object({
  page,
  limit: z.coerce.number().int().min(1).max(50, 'limit must be at most 50').default(20),
  category,
});

/** GET /api/users/:username/profile and /elo-history */
export const categoryQuerySchema = z.object({ category });

/** GET /api/problems?category=&track= (no category: every problem) */
export const problemsQuerySchema = z.object({
  category: categorySchema.optional(),
  track: trackSchema.optional(),
});

export const historyQuerySchema = z.object({
  page,
  limit: z.coerce.number().int().min(1).max(50, 'limit must be at most 50').default(10),
  mode: z
    .enum(['all', 'ranked', 'private'], { error: 'mode must be all, ranked or private' })
    .default('all'),
  /** No category: matches of both categories. */
  category: categorySchema.optional(),
});

export const usernameParam = z.string().regex(/^[A-Za-z0-9_]{3,20}$/);
export const idParam = z.coerce.number().int().positive();
