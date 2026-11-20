/**
 * Renders untrusted HTML/CSS to PNG with Chromium (Playwright).
 *
 * Defense in depth, for every render:
 *   1. Sanitize: the composed document is parsed by the browser's own HTML parser (DOMParser, an
 *      inert document: nothing runs or loads) and <script>, <iframe>, <object>, <embed>, <link>,
 *      <meta http-equiv>, <base>, … plus every on* attribute and javascript: URL are removed.
 *   2. Fresh browser context + page per render, JavaScript disabled, closed afterwards.
 *   3. Network: every request is intercepted and aborted, except the canvas document itself
 *      (served from memory). data: URIs never hit the network, so they still work. The document
 *      also gets a strict Content-Security-Policy header, and Chromium is launched with a
 *      black-hole proxy, in case anything ever slipped past the interception.
 *   4. Hard timeout per render (5 s) and at most MAX_PAGES renders at a time (others queue).
 */
import { chromium } from 'playwright-core';
import { buildDocument } from './document.js';

export const MAX_PAGES = 2;
export const MAX_QUEUE = 32;
export const RENDER_TIMEOUT_MS = 5000;

/** The canvas document is "served" from this URL by route interception (.invalid never resolves). */
const DOCUMENT_URL = 'http://canvas.invalid/';
const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; " +
  "script-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

export class RenderError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let browserPromise = null;
let sanitizerPage = null;

function launch() {
  return chromium.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-background-networking',
      '--disable-extensions',
      '--disable-sync',
      '--no-first-run',
      // Black-hole proxy: if a request ever escaped the interception, it would go nowhere.
      '--proxy-server=http://127.0.0.1:9',
      '--proxy-bypass-list=<-loopback>',
    ],
  });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launch().then((browser) => {
      browser.on('disconnected', () => {
        browserPromise = null;
        sanitizerPage = null;
      });
      return browser;
    });
    browserPromise.catch(() => (browserPromise = null));
  }
  return browserPromise;
}

/** Long-lived about:blank page (JavaScript on, for our own code only) used to sanitize markup. */
async function getSanitizerPage() {
  if (sanitizerPage && !sanitizerPage.isClosed()) return sanitizerPage;
  const browser = await getBrowser();
  const context = await browser.newContext({ javaScriptEnabled: true });
  await context.route('**/*', (route) => route.abort('blockedbyclient'));
  sanitizerPage = await context.newPage();
  return sanitizerPage;
}

/**
 * Runs inside the browser. `markup` is only ever handed to DOMParser, which builds an inert
 * document: scripts don't run, resources don't load. Returns the cleaned, re-serialized document.
 */
function sanitizeInBrowser(markup) {
  const doc = new globalThis.DOMParser().parseFromString(markup, 'text/html');
  const removed = [];
  const FORBIDDEN =
    'script,iframe,frame,frameset,object,embed,applet,link,base,portal,noscript,meta[http-equiv]';
  for (const el of doc.querySelectorAll(FORBIDDEN)) {
    removed.push(el.localName);
    el.remove();
  }
  for (const el of doc.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      // Browsers ignore whitespace/control characters in URLs ("java\tscript:"), so do we.
      const value = [...attr.value]
        .filter((c) => c.charCodeAt(0) > 0x20)
        .join('')
        .toLowerCase();
      const scriptUrl = /^(javascript|vbscript):/.test(value);
      if (name.startsWith('on') || name === 'srcdoc' || scriptUrl) {
        removed.push(`@${name}`);
        el.removeAttribute(attr.name);
      }
    }
  }
  return { html: `<!doctype html>${doc.documentElement.outerHTML}`, removed };
}

export async function sanitize(markup) {
  const page = await getSanitizerPage();
  return page.evaluate(sanitizeInBrowser, markup);
}

// ----------------------------------------------------------------------------------------------
// Concurrency: at most MAX_PAGES renders at once, FIFO queue for the rest.

let active = 0;
const waiting = [];

async function acquire() {
  if (active < MAX_PAGES) {
    active += 1;
    return;
  }
  if (waiting.length >= MAX_QUEUE) {
    throw new RenderError('RENDERER_BUSY', 'The renderer is busy. Try again in a moment.', 503);
  }
  await new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else active -= 1;
}

export const poolStatus = () => ({ active, waiting: waiting.length, maxPages: MAX_PAGES });

/**
 * Renders { html, css } on a width × height canvas. Returns { png: Buffer, blockedRequests,
 * removed, renderMs }. `timeoutMs` can only lower the limit (used by tests).
 */
export async function render({ html, css, width, height, timeoutMs = RENDER_TIMEOUT_MS }) {
  const limit = Math.min(timeoutMs, RENDER_TIMEOUT_MS);
  await acquire();
  const started = Date.now();
  const state = { context: null, timedOut: false };
  const work = renderInFreshPage({ html, css, width, height, limit, state });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      state.timedOut = true;
      state.context?.close().catch(() => {}); // aborts navigation/screenshot in progress
      reject(new RenderError('RENDER_TIMEOUT', `The page took longer than ${limit} ms to render.`));
    }, limit);
  });
  try {
    const result = await Promise.race([work, timeout]);
    return { ...result, renderMs: Date.now() - started };
  } catch (err) {
    if (err instanceof RenderError) throw err;
    if (err?.name === 'TimeoutError') {
      throw new RenderError('RENDER_TIMEOUT', `The page took longer than ${limit} ms to render.`);
    }
    // A crashed/closed browser is our problem (503, retry later); anything else is this page.
    if (!(await browserConnected())) {
      throw new RenderError('RENDERER_UNAVAILABLE', 'The browser is restarting.', 503);
    }
    console.warn('[renderer] page failed to render:', err.message.split('\n')[0]);
    throw new RenderError('RENDER_FAILED', 'This page could not be rendered.');
  } finally {
    clearTimeout(timer);
    // The pool slot is freed only once the browser work is really over (even after a timeout).
    work
      .catch(() => {})
      .finally(async () => {
        await state.context?.close().catch(() => {});
        release();
      });
  }
}

async function renderInFreshPage({ html, css, width, height, limit, state }) {
  const browser = await getBrowser();
  const { html: documentHtml, removed } = await sanitize(buildDocument({ html, css }));
  if (state.timedOut) throw new RenderError('RENDER_TIMEOUT', 'Timed out.');
  state.context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    acceptDownloads: false,
  });
  if (state.timedOut) throw new RenderError('RENDER_TIMEOUT', 'Timed out.');
  let blockedRequests = 0;
  await state.context.route('**/*', (route) => {
    if (route.request().url() === DOCUMENT_URL) {
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        headers: { 'Content-Security-Policy': CSP },
        body: documentHtml,
      });
    }
    blockedRequests += 1;
    return route.abort('blockedbyclient');
  });
  const page = await state.context.newPage();
  await page.goto(DOCUMENT_URL, { waitUntil: 'load', timeout: limit });
  const png = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width, height },
    animations: 'disabled',
    caret: 'hide',
    timeout: limit,
  });
  return { png, blockedRequests, removed };
}

/** Starts the browser (and the sanitizer page) ahead of the first request. */
export async function warmUp() {
  await getSanitizerPage();
}

export async function browserConnected() {
  try {
    return (await getBrowser()).isConnected();
  } catch {
    return false;
  }
}

export async function closeBrowser() {
  const browser = await browserPromise?.catch(() => null);
  await browser?.close();
}
