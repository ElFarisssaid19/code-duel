import { getLeaderboard } from '../services/leaderboard.service.js';
import { leaderboardQuerySchema } from '../validators/query.schemas.js';

/** GET /api/leaderboard?page=&limit=&category=ALGO|FRONTEND */
export async function leaderboard(req, res) {
  const { page, limit, category } = leaderboardQuerySchema.parse(req.query);
  res.json(await getLeaderboard({ page, limit, category, userId: req.user.id }));
}
