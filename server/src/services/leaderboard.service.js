/**
 * Leaderboard, per category (ALGO | FRONTEND): users with at least one ranked match in that
 * category (W/L/D only count ranked games), ordered by elo desc, wins desc, oldest account first.
 * Equal ELO shares a rank (RANK(): 1, 1, 3).
 */
import { prisma } from '../lib/prisma.js';

export { START_ELO } from '../lib/ratings.js';

export const winRate = (wins, gamesPlayed) =>
  gamesPlayed ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0;

function toRow(r) {
  const gamesPlayed = r.wins + r.losses + r.draws;
  return {
    rank: Number(r.rnk),
    userId: r.id,
    username: r.username,
    elo: r.elo,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    gamesPlayed,
    winRate: winRate(r.wins, gamesPlayed),
  };
}

/** The ranked row of one user in a category, or null if they haven't played ranked there. 1 query. */
export async function rankOf(userId, category = 'ALGO') {
  const [row] = await prisma.$queryRaw`
    SELECT * FROM (
      SELECT u.id, u.username, r.elo, r.wins, r.losses, r.draws,
             RANK() OVER (ORDER BY r.elo DESC) AS rnk
      FROM UserRating r JOIN \`User\` u ON u.id = r.userId
      WHERE r.category = ${category} AND r.wins + r.losses + r.draws > 0
    ) ranked
    WHERE id = ${userId}`;
  return row ? toRow(row) : null;
}

/** One page of a category's leaderboard + the current user's row. 3 queries, whatever the page size. */
export async function getLeaderboard({ page, limit, userId, category = 'ALGO' }) {
  const offset = (page - 1) * limit;
  const [rows, [{ total }], me] = await Promise.all([
    prisma.$queryRaw`
      SELECT u.id, u.username, r.elo, r.wins, r.losses, r.draws,
             RANK() OVER (ORDER BY r.elo DESC) AS rnk
      FROM UserRating r JOIN \`User\` u ON u.id = r.userId
      WHERE r.category = ${category} AND r.wins + r.losses + r.draws > 0
      ORDER BY r.elo DESC, r.wins DESC, u.createdAt ASC, u.id ASC
      LIMIT ${limit} OFFSET ${offset}`,
    prisma.$queryRaw`
      SELECT COUNT(*) AS total FROM UserRating r
      WHERE r.category = ${category} AND r.wins + r.losses + r.draws > 0`,
    rankOf(userId, category),
  ]);
  const entries = rows.map(toRow);
  return {
    category,
    page,
    limit,
    total: Number(total),
    totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    entries,
    me: me && { ...me, onPage: entries.some((e) => e.userId === userId) },
  };
}
