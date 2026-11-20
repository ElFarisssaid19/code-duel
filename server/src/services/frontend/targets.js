/**
 * FRONTEND target images: PNG files in <DATA_DIR>/targets/<slug>.png, written by the seed (it
 * renders each problem's reference solution with the renderer service) and served by
 * GET /api/problems/:slug/target.png.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';

const SERVER_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export const dataDir = () =>
  isAbsolute(env.DATA_DIR) ? env.DATA_DIR : resolve(SERVER_ROOT, env.DATA_DIR);

/** Relative path stored in Problem.targetImagePath. */
export const targetImagePathFor = (slug) => `targets/${slug}.png`;

export function resolveTarget(relativePath) {
  const full = resolve(dataDir(), relativePath);
  if (!full.startsWith(join(dataDir(), 'targets'))) throw new Error('Invalid target path');
  return full;
}

const cache = new Map(); // path → Buffer

export async function readTarget(relativePath) {
  const cached = cache.get(relativePath);
  if (cached) return cached;
  const png = await readFile(resolveTarget(relativePath));
  cache.set(relativePath, png);
  return png;
}

export async function writeTarget(relativePath, png) {
  const full = resolveTarget(relativePath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, png);
  cache.set(relativePath, png);
}

/** Tests only. */
export const clearTargetCache = () => cache.clear();
