/**
 * Pixel scoring with pixelmatch. Anti-aliased pixels are detected and not counted as different
 * (includeAA: false), and `threshold` 0.1 tolerates tiny color differences.
 *
 *   rawScore = 100 × (1 − differentPixels / totalPixels)
 *   score    = 100 × (1 − differentPixels / blankDifferentPixels), clamped to [0, 100]
 *
 * blankDifferentPixels is how many pixels an EMPTY page (a white canvas) differs from the target.
 * Without it, sparse targets (black text on white, small components) would give an empty page
 * 95–99 %: above the "solved" thresholds. Normalized, an empty page always scores 0 and the
 * reference 100; on full-canvas designs both formulas are the same. Both are rounded to 2 decimals.
 */
import { createHash } from 'node:crypto';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { RenderError } from './renderer.js';

export const PIXELMATCH_THRESHOLD = 0.1;
const OPTIONS = { threshold: PIXELMATCH_THRESHOLD, includeAA: false };

const round2 = (n) => Math.round(n * 100) / 100;

export function decodePng(buffer, label) {
  try {
    return PNG.sync.read(buffer);
  } catch {
    throw new RenderError('INVALID_TARGET', `${label} is not a valid PNG.`, 400);
  }
}

const blankCache = new Map(); // sha1(target) → blankDifferentPixels (targets are few and fixed)

/** Pixels where a white canvas differs from the target. */
function blankDifferentPixels(target, targetBuffer) {
  const key = createHash('sha1').update(targetBuffer).digest('hex');
  if (!blankCache.has(key)) {
    const white = Buffer.alloc(target.width * target.height * 4, 255);
    if (blankCache.size >= 256) blankCache.delete(blankCache.keys().next().value);
    blankCache.set(key, pixelmatch(target.data, white, null, target.width, target.height, OPTIONS));
  }
  return blankCache.get(key);
}

/**
 * Compares two PNG buffers of the same size. Returns { score, rawScore, differentPixels,
 * blankDifferentPixels, totalPixels, diffPng }.
 */
export function comparePngs(actualBuffer, targetBuffer) {
  const actual = decodePng(actualBuffer, 'The rendered image');
  const target = decodePng(targetBuffer, 'targetPng');
  if (actual.width !== target.width || actual.height !== target.height) {
    throw new RenderError(
      'SIZE_MISMATCH',
      `targetPng is ${target.width}×${target.height}, but the canvas is ${actual.width}×${actual.height}.`,
      400,
    );
  }
  const { width, height } = target;
  const diff = new PNG({ width, height });
  const differentPixels = pixelmatch(target.data, actual.data, diff.data, width, height, OPTIONS);
  const totalPixels = width * height;
  const blank = blankDifferentPixels(target, targetBuffer) || totalPixels;
  const score = round2(100 * Math.min(1, Math.max(0, 1 - differentPixels / blank)));
  return {
    score,
    rawScore: round2(100 * (1 - differentPixels / totalPixels)),
    differentPixels,
    blankDifferentPixels: blank,
    totalPixels,
    diffPng: PNG.sync.write(diff),
  };
}
