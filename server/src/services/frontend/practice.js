/**
 * FRONTEND practice submissions: score with the renderer, save a Submission, return the result
 * (score, solved, character count and the diff image).
 */
import { HttpError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { RendererUnavailableError, RenderFailedError } from '../renderer/index.js';
import { scoreFrontendSubmission } from './scoring.js';
import { trackLanguage, TrackRuleError } from './trackRules.js';

/** Renderer/track errors → HTTP errors with the standard shape. */
export function toFrontendHttpError(err) {
  if (err instanceof TrackRuleError) {
    return new HttpError(400, 'TRACK_RULE_VIOLATION', err.message, { [err.field]: [err.message] });
  }
  if (err instanceof RenderFailedError) {
    if (err.code === 'RENDER_TIMEOUT') {
      return new HttpError(422, 'RENDER_TIMEOUT', 'Your page took more than 5 seconds to render.');
    }
    return new HttpError(err.code === 'CODE_TOO_LARGE' ? 400 : 422, err.code, err.message);
  }
  if (err instanceof RendererUnavailableError) {
    console.error('[renderer]', err.message);
    return new HttpError(
      503,
      'RENDERER_UNAVAILABLE',
      'The renderer is unavailable. Try again in a moment.',
    );
  }
  if (err?.code === 'ENOENT') {
    console.error('[renderer] missing target image:', err.path);
    return new HttpError(503, 'TARGET_MISSING', 'This problem has no target image yet.');
  }
  return err;
}

export async function submitFrontendPractice({ userId, problem, html, css }) {
  let result;
  try {
    result = await scoreFrontendSubmission(problem, { html, css });
  } catch (err) {
    throw toFrontendHttpError(err);
  }
  const submission = await prisma.submission.create({
    data: {
      userId,
      problemId: problem.id,
      matchId: null,
      language: trackLanguage(problem.track),
      code: problem.track === 'CSS' ? '' : html,
      css: problem.track === 'HTML' ? '' : css,
      status: result.solved ? 'ACCEPTED' : 'WRONG_ANSWER',
      passed: result.solved ? 1 : 0,
      total: 1,
      score: result.score,
      charCount: result.charCount,
    },
    select: { id: true, status: true, score: true, charCount: true, createdAt: true },
  });
  return {
    score: result.score,
    solved: result.solved,
    threshold: result.threshold,
    charCount: result.charCount,
    diffImage: result.diffPng.toString('base64'),
    submission: { ...submission, score: Number(submission.score) },
  };
}
