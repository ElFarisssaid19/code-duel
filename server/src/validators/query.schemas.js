import { z } from 'zod';

const page = z.coerce
  .number({ error: 'page must be a number' })
  .int()
  .min(1, 'page must be at least 1')
  .default(1);

export const leaderboardQuerySchema = z.object({
  page,
  limit: z.coerce.number().int().min(1).max(50, 'limit must be at most 50').default(20),
});

export const historyQuerySchema = z.object({
  page,
  limit: z.coerce.number().int().min(1).max(50, 'limit must be at most 50').default(10),
  mode: z
    .enum(['all', 'ranked', 'private'], { error: 'mode must be all, ranked or private' })
    .default('all'),
});

export const usernameParam = z.string().regex(/^[A-Za-z0-9_]{3,20}$/);
export const idParam = z.coerce.number().int().positive();
