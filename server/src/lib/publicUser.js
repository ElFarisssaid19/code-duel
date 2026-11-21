/**
 * The only user fields that may leave the server. Never add passwordHash here.
 * Use `publicUserSelect` in Prisma queries, then `toPublicUser` on the row.
 *
 * Ratings live in UserRating (one row per category). The public user carries all of them in
 * `ratings: { ALGO, FRONTEND }`; the top-level elo / wins / losses / draws are the ALGO rating,
 * kept so existing clients keep working.
 */
import { ratingSelect, ratingsByCategory } from './ratings.js';

export const PUBLIC_USER_FIELDS = [
  'id',
  'username',
  'email',
  'preferredLanguage',
  'allowGhosts',
  'createdAt',
];

export const publicUserSelect = {
  ...Object.fromEntries(PUBLIC_USER_FIELDS.map((f) => [f, true])),
  ghostNoticeDismissedAt: true,
  ratings: { select: ratingSelect },
};

export function toPublicUser(user) {
  const ratings = ratingsByCategory(user.ratings);
  const { elo, wins, losses, draws } = ratings.ALGO;
  return {
    ...Object.fromEntries(PUBLIC_USER_FIELDS.map((f) => [f, user[f]])),
    allowGhosts: Boolean(user.allowGhosts), // raw SQL returns 1/0
    // Whether the one-time "your runs may be replayed as ghosts" banner was dismissed.
    ghostNoticeDismissed: Boolean(user.ghostNoticeDismissedAt),
    elo,
    wins,
    losses,
    draws,
    ratings,
  };
}
