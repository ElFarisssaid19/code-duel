import { HttpError } from '../lib/errors.js';
import { getMatchCode, getMatchDetails } from '../services/matchDetails.service.js';
import { idParam } from '../validators/query.schemas.js';

function matchId(req) {
  const parsed = idParam.safeParse(req.params.id);
  if (!parsed.success) throw new HttpError(404, 'NOT_FOUND', 'Match not found');
  return parsed.data;
}

/** GET /api/matches/:id: summary + timeline (no code) */
export async function show(req, res) {
  res.json({ match: await getMatchDetails(matchId(req), req.user.id) });
}

/** GET /api/matches/:id/code: final code, participants only, after the match finished */
export async function code(req, res) {
  res.json(await getMatchCode(matchId(req), req.user.id));
}
