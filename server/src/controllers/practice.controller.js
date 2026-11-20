import { judgePractice } from '../services/practice.service.js';

const judge = (mode) => async (req, res) => {
  res.json(await judgePractice({ ...req.body, userId: req.user.id, slug: req.params.slug, mode }));
};

/** POST /api/practice/:slug/run { language, code } → { result } (sample tests) */
export const run = judge('run');

/**
 * POST /api/practice/:slug/submit
 *   ALGO     { language, code } → { result, submission } (all tests)
 *   FRONTEND { html, css }      → { score, solved, threshold, charCount, diffImage, submission }
 */
export const submit = judge('submit');
