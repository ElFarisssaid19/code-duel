/**
 * Client for the renderer service (infra/renderer: Node + Playwright's Chromium headless shell).
 *
 *   render({ html, css, width, height })             → Buffer (PNG)
 *   compare({ html, css, width, height, targetPng })  → { score, differentPixels, totalPixels,
 *                                                       diffPng (Buffer), renderMs }
 *   health()                                         → boolean
 */
import { RendererUnavailableError, RenderFailedError } from '../errors.js';

const REQUEST_TIMEOUT_MS = 15_000; // > the renderer's own 5 s render limit, plus queueing

export function createPlaywrightRenderer({ baseUrl }) {
  async function post(path, body) {
    let res;
    try {
      res = await fetch(new URL(path, baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new RendererUnavailableError(`Renderer unreachable at ${baseUrl}: ${err.message}`, {
        cause: err,
      });
    }
    if (res.ok) return res;
    const { error } = await res.json().catch(() => ({ error: {} }));
    if (res.status >= 500 || res.status === 503) {
      throw new RendererUnavailableError(
        `Renderer error ${res.status}: ${error?.message ?? 'unknown'}`,
      );
    }
    throw new RenderFailedError(error?.code ?? 'RENDER_FAILED', error?.message ?? 'Render failed');
  }

  return {
    async render({ html, css, width, height, timeoutMs }) {
      const res = await post('/render', { html, css, width, height, timeoutMs });
      return Buffer.from(await res.arrayBuffer());
    },

    async compare({ html, css, width, height, targetPng, timeoutMs }) {
      const res = await post('/compare', {
        html,
        css,
        width,
        height,
        timeoutMs,
        targetPng: targetPng.toString('base64'),
      });
      const body = await res.json();
      return { ...body, diffPng: Buffer.from(body.diffPng, 'base64') };
    },

    async health() {
      try {
        const res = await fetch(new URL('/health', baseUrl), { signal: AbortSignal.timeout(3000) });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
