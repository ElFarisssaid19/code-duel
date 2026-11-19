import { judgePractice } from '../services/practice.service.js';

const judge = (mode) => async (req, res) => {
  const { language, code } = req.body;
  res.json(
    await judgePractice({ userId: req.user.id, slug: req.params.slug, language, code, mode }),
  );
};

/** POST /api/practice/:slug/run { language, code } → { result } (sample tests) */
export const run = judge('run');

/** POST /api/practice/:slug/submit { language, code } → { result, submission } (all tests) */
export const submit = judge('submit');
