/**
 * Leaderboard: users with at least one ranked match (W/L/D only count ranked games), ordered by
 * elo desc, wins desc, oldest account first. Equal ELO shares a rank (RANK(): 1, 1, 3).
 */
import { prisma } from '../lib/prisma.js';

export const START_ELO = 1000;

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

/** The ranked row of one user, or null if they haven't played a ranked match. 1 query. */
export async function rankOf(userId) {
  const [row] = await prisma.$queryRaw`
    SELECT * FROM (
      SELECT id, username, elo, wins, losses, draws,
             RANK() OVER (ORDER BY elo DESC) AS rnk
      FROM \`User\`
      WHERE wins + losses + draws > 0
    ) ranked
    WHERE id = ${userId}`;
  return row ? toRow(row) : null;
}

/** One page of the leaderboard + the current user's row. 3 queries, whatever the page size. */
export async function getLeaderboard({ page, limit, userId }) {
  const offset = (page - 1) * limit;
  const [rows, [{ total }], me] = await Promise.all([
    prisma.$queryRaw`
      SELECT id, username, elo, wins, losses, draws,
             RANK() OVER (ORDER BY elo DESC) AS rnk
      FROM \`User\`
      WHERE wins + losses + draws > 0
      ORDER BY elo DESC, wins DESC, createdAt ASC, id ASC
      LIMIT ${limit} OFFSET ${offset}`,
    prisma.$queryRaw`SELECT COUNT(*) AS total FROM \`User\` WHERE wins + losses + draws > 0`,
    rankOf(userId),
  ]);
  const entries = rows.map(toRow);
  return {
    page,
    limit,
    total: Number(total),
    totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    entries,
    me: me && { ...me, onPage: entries.some((e) => e.userId === userId) },
  };
}
