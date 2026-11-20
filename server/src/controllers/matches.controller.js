import { HttpError } from '../lib/errors.js';
import { toFrontendHttpError } from '../services/frontend/practice.js';
import {
  getMatchCode,
  getMatchDetails,
  getMatchPreview,
} from '../services/matchDetails.service.js';
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

/** GET /api/matches/:id/preview/:userId.png: FRONTEND final preview (anyone, after the match) */
export async function preview(req, res) {
  const user = idParam.safeParse(req.params.userId);
  if (!user.success) throw new HttpError(404, 'NOT_FOUND', 'Match not found');
  let png;
  try {
    png = await getMatchPreview(matchId(req), user.data);
  } catch (err) {
    throw toFrontendHttpError(err);
  }
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' });
  res.send(png);
}
