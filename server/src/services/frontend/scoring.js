/**
 * Scores a FRONTEND submission: applies the track rules, renders it with the renderer service
 * and compares it with the problem's target image (pixelmatch, threshold 0.1, anti-aliasing
 * tolerant). score = 100 × (1 − differentPixels / totalPixels), 2 decimals.
 * "Solved" when score ≥ the problem's matchThreshold.
 */
import { compareWithTarget } from '../renderer/index.js';
import { readTarget } from './targets.js';
import { applyTrackRules, charCount } from './trackRules.js';

/** Default thresholds per track (a problem can override with matchThreshold). */
export const DEFAULT_THRESHOLDS = { CSS: 99.5, HTML: 98, HTML_CSS: 98 };

export const thresholdOf = (problem) =>
  problem.matchThreshold === null || problem.matchThreshold === undefined
    ? DEFAULT_THRESHOLDS[problem.track]
    : Number(problem.matchThreshold);

/**
 * problem: { track, fixedHtml, canvasWidth, canvasHeight, matchThreshold, targetImagePath }.
 * Returns { score, solved, threshold, charCount, diffPng (Buffer), renderMs }.
 * Throws TrackRuleError, RenderFailedError or RendererUnavailableError.
 */
export async function scoreFrontendSubmission(problem, code) {
  const toRender = applyTrackRules(problem, code);
  const targetPng = await readTarget(problem.targetImagePath);
  const result = await compareWithTarget({
    ...toRender,
    width: problem.canvasWidth,
    height: problem.canvasHeight,
    targetPng,
  });
  const threshold = thresholdOf(problem);
  return {
    score: result.score,
    solved: result.score >= threshold,
    threshold,
    charCount: charCount(problem, code),
    diffPng: result.diffPng,
    renderMs: result.renderMs,
  };
}
