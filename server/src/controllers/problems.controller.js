import { getProblemBySlug, listProblems } from '../services/problem.service.js';

/** GET /api/problems → { problems: [{ id, slug, title, difficulty, solved }] } */
export async function list(req, res) {
  res.json({ problems: await listProblems(req.user.id) });
}

/** GET /api/problems/:slug → { problem } (sample tests only) */
export async function show(req, res) {
  res.json({ problem: await getProblemBySlug(req.params.slug) });
}
