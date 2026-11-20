/**
 * FRONTEND problems: structural validation, target generation and verification through the real
 * renderer. Used by the seed (index.js) and by the test suite.
 *
 * For each problem: render the reference solution (→ the target PNG), then check that
 *   - the reference scores exactly 100.00 against it (rendering is deterministic),
 *   - an empty page and the starter code score clearly below the threshold (≥ 20 points lower).
 */
import { compareWithTarget, renderPage } from '../../src/services/renderer/index.js';
import { DEFAULT_THRESHOLDS, thresholdOf } from '../../src/services/frontend/scoring.js';
import { targetImagePathFor } from '../../src/services/frontend/targets.js';
import { EDITABLE } from '../../src/services/frontend/trackRules.js';

const HEX = /^#[0-9a-f]{6}$/i;
const CANVAS_SIZES = { CSS: [400, 300], HTML: [600, 400], HTML_CSS: [600, 400] };
export const BLANK_MARGIN = 20;

export function validateFrontendProblem(p) {
  const errors = [];
  if (!EDITABLE[p.track]) errors.push(`unknown track ${p.track}`);
  if (!['EASY', 'MEDIUM', 'HARD'].includes(p.difficulty)) errors.push('invalid difficulty');
  const [w, h] = CANVAS_SIZES[p.track] ?? [];
  if (p.canvas?.width !== w || p.canvas?.height !== h) errors.push(`canvas must be ${w}×${h}`);
  if (!Array.isArray(p.palette) || p.palette.length === 0 || !p.palette.every((c) => HEX.test(c)))
    errors.push('palette must be a non-empty list of #rrggbb colors');
  if (!p.description?.trim()) errors.push('missing description');
  if (p.track === 'CSS' && !p.fixedHtml?.trim()) errors.push('CSS track needs fixedHtml');
  if (p.track !== 'CSS' && p.fixedHtml) errors.push('only the CSS track has fixedHtml');
  if (!p.reference || typeof p.reference.html !== 'string' || typeof p.reference.css !== 'string')
    errors.push('missing reference { html, css }');
  if (p.track === 'HTML' && p.reference?.css) errors.push('HTML track reference must have no CSS');
  if (!p.starter || typeof p.starter.html !== 'string' || typeof p.starter.css !== 'string')
    errors.push('missing starter { html, css }');
  return errors;
}

/** What the renderer gets for a given { html, css } (the CSS track always uses fixedHtml). */
const pageFor = (p, { html, css }) => ({
  html: p.track === 'CSS' ? p.fixedHtml : html,
  css: p.track === 'HTML' ? '' : css,
  width: p.canvas.width,
  height: p.canvas.height,
});

/** Renders the target and verifies it. Returns { png, failures, scores }. */
export async function buildAndVerifyTarget(p) {
  const failures = [];
  const png = await renderPage(pageFor(p, p.reference));
  const score = async (code) =>
    (await compareWithTarget({ ...pageFor(p, code), targetPng: png })).score;

  const scores = {
    reference: await score(p.reference),
    blank: await score({ html: '', css: '' }),
    starter: await score(p.starter),
  };
  const threshold = thresholdOf(p);
  if (scores.reference !== 100) failures.push(`reference scores ${scores.reference}, not 100.00`);
  for (const what of ['blank', 'starter']) {
    if (scores[what] > threshold - BLANK_MARGIN) {
      failures.push(`${what} page scores ${scores[what]}: must be ≤ ${threshold - BLANK_MARGIN}`);
    }
  }
  return { png, failures, scores };
}

/** Problem row data (without slug) for a FRONTEND problem definition. */
export function frontendProblemData(problem) {
  return {
    title: problem.title,
    description: problem.description,
    difficulty: problem.difficulty,
    category: 'FRONTEND',
    track: problem.track,
    starterCode: problem.starter,
    functionName: null,
    canvasWidth: problem.canvas.width,
    canvasHeight: problem.canvas.height,
    fixedHtml: problem.fixedHtml ?? null,
    palette: problem.palette,
    matchThreshold: problem.matchThreshold ?? DEFAULT_THRESHOLDS[problem.track],
    targetImagePath: targetImagePathFor(problem.slug),
    referenceHtml: problem.reference.html,
    referenceCss: problem.reference.css,
  };
}
