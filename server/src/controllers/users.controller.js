import { HttpError } from '../lib/errors.js';
import { getEloHistory, getMatchHistory, getProfile } from '../services/profile.service.js';
import {
  categoryQuerySchema,
  historyQuerySchema,
  usernameParam,
} from '../validators/query.schemas.js';

function username(req) {
  const parsed = usernameParam.safeParse(req.params.username);
  if (!parsed.success) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  return parsed.data;
}

/** GET /api/users/:username/profile?category=ALGO|FRONTEND */
export async function profile(req, res) {
  const name = username(req);
  const { category } = categoryQuerySchema.parse(req.query);
  res.json({ profile: await getProfile(name, category) });
}

/** GET /api/users/:username/elo-history?category=ALGO|FRONTEND */
export async function eloHistory(req, res) {
  const name = username(req);
  const { category } = categoryQuerySchema.parse(req.query);
  res.json(await getEloHistory(name, category));
}

/** GET /api/users/:username/matches?page=&limit=&mode=all|ranked|private&category= */
export async function matches(req, res) {
  const name = username(req);
  res.json(await getMatchHistory(name, historyQuerySchema.parse(req.query)));
}
