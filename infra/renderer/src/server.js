/**
 * Code Duel renderer: a tiny HTTP API (no framework) in front of Chromium.
 *
 *   GET  /health   → { status, browser, pool }
 *   POST /render   { html, css, width, height }            → image/png
 *   POST /compare  { html, css, width, height, targetPng }  → { score, rawScore, differentPixels,
 *                                         blankDifferentPixels, totalPixels, diffPng, renderMs, … }
 * PNGs in JSON are base64. Errors: { error: { code, message } }.
 *
 * Only reachable from localhost / the Docker network: it renders untrusted code.
 */
import { createServer } from 'node:http';
import { comparePngs } from './compare.js';
import {
  browserConnected,
  closeBrowser,
  poolStatus,
  render,
  RENDER_TIMEOUT_MS,
  RenderError,
  warmUp,
} from './renderer.js';

const PORT = Number(process.env.PORT ?? 5070);
export const MAX_CODE_BYTES = 20 * 1024;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // code + a base64 target PNG
const MAX_SIDE = 1600;

function send(res, status, body, type = 'application/json') {
  const payload = type === 'application/json' ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(payload);
}

const fail = (res, err) =>
  send(res, err.status ?? 500, {
    error: { code: err.code ?? 'INTERNAL_ERROR', message: err.message },
  });

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES)
      throw new RenderError('BODY_TOO_LARGE', 'Request body is too large.', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RenderError('INVALID_JSON', 'Malformed JSON body.', 400);
  }
}

/** Validates { html, css, width, height, timeoutMs? }. */
function parseRenderRequest(body) {
  const bad = (message) => new RenderError('VALIDATION_ERROR', message, 400);
  if (!body || typeof body !== 'object') throw bad('Expected a JSON object.');
  const html = body.html ?? '';
  const css = body.css ?? '';
  if (typeof html !== 'string' || typeof css !== 'string')
    throw bad('html and css must be strings.');
  if (Buffer.byteLength(html, 'utf8') + Buffer.byteLength(css, 'utf8') > MAX_CODE_BYTES) {
    throw new RenderError('CODE_TOO_LARGE', 'HTML + CSS must be at most 20 KB.', 413);
  }
  const { width, height } = body;
  for (const [name, value] of [
    ['width', width],
    ['height', height],
  ]) {
    if (!Number.isInteger(value) || value < 1 || value > MAX_SIDE) {
      throw bad(`${name} must be an integer between 1 and ${MAX_SIDE}.`);
    }
  }
  const timeoutMs = body.timeoutMs ?? RENDER_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1)
    throw bad('timeoutMs must be a positive integer.');
  return { html, css, width, height, timeoutMs };
}

const routes = {
  'GET /health': async (req, res) => {
    const browser = await browserConnected();
    send(res, browser ? 200 : 503, {
      status: browser ? 'ok' : 'error',
      browser,
      pool: poolStatus(),
    });
  },

  'POST /render': async (req, res) => {
    const { png } = await render(parseRenderRequest(await readJson(req)));
    send(res, 200, png, 'image/png');
  },

  'POST /compare': async (req, res) => {
    const body = await readJson(req);
    const options = parseRenderRequest(body);
    if (typeof body.targetPng !== 'string' || body.targetPng.length === 0) {
      throw new RenderError('VALIDATION_ERROR', 'targetPng (base64 PNG) is required.', 400);
    }
    const { png, blockedRequests, removed, renderMs } = await render(options);
    const started = Date.now();
    const { diffPng, ...scores } = comparePngs(png, Buffer.from(body.targetPng, 'base64'));
    send(res, 200, {
      ...scores,
      diffPng: diffPng.toString('base64'),
      renderMs,
      compareMs: Date.now() - started,
      blockedRequests,
      removed,
    });
  },
};

const server = createServer(async (req, res) => {
  const handler = routes[`${req.method} ${new URL(req.url, 'http://x').pathname}`];
  if (!handler) return fail(res, new RenderError('NOT_FOUND', 'Unknown route.', 404));
  try {
    await handler(req, res);
  } catch (err) {
    if (!(err instanceof RenderError)) console.error('[renderer]', err);
    if (!res.headersSent) fail(res, err);
  }
});

server.requestTimeout = 30_000;
server.listen(PORT, () => {
  console.log(`[renderer] listening on :${PORT}`);
  warmUp().then(
    () => console.log('[renderer] Chromium ready'),
    (err) => console.error('[renderer] Chromium failed to start:', err.message),
  );
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    server.close();
    await closeBrowser().catch(() => {});
    process.exit(0);
  });
}
