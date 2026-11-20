/**
 * Renderer service entry point (FRONTEND problems). Picks the provider from env
 * RENDERER_PROVIDER (default "playwright"), like services/judge does for code execution.
 *
 * Provider interface (see providers/playwright.js):
 *   render({ html, css, width, height }) → PNG Buffer
 *   compare({ html, css, width, height, targetPng }) → { score, diffPng, … }
 *   health() → boolean
 * Tests can swap the provider with setRenderer().
 */
import { env } from '../../config/env.js';
import { createPlaywrightRenderer } from './providers/playwright.js';

export { RendererUnavailableError, RenderFailedError } from './errors.js';

const PROVIDERS = {
  playwright: () => createPlaywrightRenderer({ baseUrl: env.RENDERER_URL }),
};

let provider;
export function getRenderer() {
  provider ??= PROVIDERS[env.RENDERER_PROVIDER]();
  return provider;
}

/** Tests only: replace the provider (null restores the configured one). */
export function setRenderer(fake) {
  provider = fake ?? undefined;
}

export const renderPage = (options) => getRenderer().render(options);
export const compareWithTarget = (options) => getRenderer().compare(options);
export const rendererHealth = () => getRenderer().health();
