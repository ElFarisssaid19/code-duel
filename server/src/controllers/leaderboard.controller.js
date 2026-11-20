import { getLeaderboard } from '../services/leaderboard.service.js';
import { leaderboardQuerySchema } from '../validators/query.schemas.js';

/** GET /api/leaderboard?page=&limit= */
export async function leaderboard(req, res) {
  const { page, limit } = leaderboardQuerySchema.parse(req.query);
  res.json(await getLeaderboard({ page, limit, userId: req.user.id }));
}
