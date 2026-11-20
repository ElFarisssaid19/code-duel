import { HttpError } from '../lib/errors.js';
import { readTarget } from '../services/frontend/targets.js';
import { getProblemBySlug, getTargetImagePath, listProblems } from '../services/problem.service.js';
import { problemsQuerySchema } from '../validators/query.schemas.js';

/** GET /api/problems?category=ALGO|FRONTEND&track= → { problems } (default category: ALGO) */
export async function list(req, res) {
  const filters = problemsQuerySchema.parse(req.query);
  res.json({ problems: await listProblems(req.user.id, filters) });
}

/** GET /api/problems/:slug → { problem } (ALGO: sample tests only; FRONTEND: brief) */
export async function show(req, res) {
  res.json({ problem: await getProblemBySlug(req.params.slug) });
}

/** GET /api/problems/:slug/target.png → the FRONTEND target image */
export async function target(req, res) {
  const path = await getTargetImagePath(req.params.slug);
  let png;
  try {
    png = await readTarget(path);
  } catch {
    throw new HttpError(404, 'NOT_FOUND', 'Target image not found. Run `npm run db:seed`.');
  }
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300' });
  res.send(png);
}
