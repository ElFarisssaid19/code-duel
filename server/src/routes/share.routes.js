/**
 * Public share endpoints (no login).
 *   GET /api/share/:shareId/card.png?format=og|story → PNG (cached on disk)
 *   GET /s/:shareId (mounted on the app, outside /api) → HTML page with Open Graph tags
 * Unknown or revoked shares → 404. Responses are `no-cache` (revalidated every time), so a
 * revoked link stops working at once; the card itself comes from the server's disk cache.
 */
import { Router } from 'express';
import { HttpError } from '../lib/errors.js';
import { publicShareRateLimit } from '../middleware/rateLimit.js';
import { toFrontendHttpError } from '../services/frontend/practice.js';
import { getCard, getSharePage } from '../services/share/index.js';

const notFound = () =>
  new HttpError(404, 'NOT_FOUND', 'This share link does not exist or was revoked.');

export const shareApiRouter = Router();
shareApiRouter.get('/:shareId/card.png', publicShareRateLimit, async (req, res) => {
  const format = req.query.format ?? 'og';
  let png;
  try {
    png = await getCard(req.params.shareId, String(format));
  } catch (err) {
    const mapped = toFrontendHttpError(err);
    throw mapped instanceof HttpError ? mapped : err;
  }
  if (!png) throw notFound();
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, no-cache' });
  res.send(png);
});

export const sharePageRouter = Router();
sharePageRouter.get('/:shareId', publicShareRateLimit, async (req, res) => {
  const html = await getSharePage(req.params.shareId);
  if (!html) {
    res
      .status(404)
      .type('html')
      .send(
        '<!doctype html><meta charset="utf-8"><title>Not found · Code Duel</title><p>This share link does not exist or was revoked.</p>',
      );
    return;
  }
  res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, no-cache' });
  res.send(html);
});
