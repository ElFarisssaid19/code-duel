/**
 * Tiny Chrome DevTools Protocol driver used to generate docs assets (icons, Open Graph image,
 * README screenshots, demo GIF). No dependencies: Node's built-in fetch + WebSocket.
 *
 * Launches headless Chrome (CHROME_PATH overrides the binary) and opens isolated pages: each
 * page has its own browser context, i.e. its own cookies, like separate browser profiles.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchBrowser({ port = 9339 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'code-duel-chrome-'));
  const chrome = spawn(
    process.env.CHROME_PATH ?? 'google-chrome',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--hide-scrollbars',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let info;
  for (let i = 0; i < 50 && !info; i++) {
    await sleep(200);
    info = await fetch(`http://127.0.0.1:${port}/json/version`).then(
      (r) => r.json(),
      () => null,
    );
  }
  if (!info) throw new Error('Could not start Chrome (set CHROME_PATH)');

  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else for (const listener of listeners) listener(msg);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (msg) =>
        msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result),
      );
      ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    });

  return {
    send,
    listeners,
    newPage: (options) => newPage({ send, listeners }, options),
    async close() {
      ws.close();
      chrome.kill();
      await sleep(300);
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

async function newPage(
  browser,
  { base = 'http://localhost:5173', width = 1440, height = 900, mobile = false, scale = 1 } = {},
) {
  const { browserContextId } = await browser.send('Target.createBrowserContext', {
    disposeOnDetach: true,
  });
  const { targetId } = await browser.send('Target.createTarget', {
    url: 'about:blank',
    browserContextId,
  });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  const errors = [];
  browser.listeners.add((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown')
      errors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await send('Runtime.enable');
  await send('Page.enable');

  const page = {
    errors,
    send,
    async viewport(w, h, isMobile = false, deviceScaleFactor = 1) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor,
        mobile: isMobile,
      });
    },
    async evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (res.exceptionDetails)
        throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
      return res.result?.value;
    },
    async goto(path) {
      await send('Page.navigate', {
        url:
          path.startsWith('http') || path.startsWith('file:') || path.startsWith('data:')
            ? path
            : base + path,
      });
      await sleep(400);
    },
    async waitFor(expression, label = expression, timeoutMs = 20_000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (await page.evaluate(expression).catch(() => false)) return;
        await sleep(100);
      }
      throw new Error(
        `Timed out waiting for ${label} (at ${await page.evaluate('location.pathname').catch(() => '?')})`,
      );
    },
    /** Clicks the first enabled button/link whose text is `label`. */
    click: (label) =>
      page.evaluate(
        `(() => { const el = [...document.querySelectorAll('button,a')].find((b) => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled); if (!el) throw new Error('No clickable element: ${label.replace(/'/g, '')}'); el.click(); return true; })()`,
      ),
    /** Sets a React-controlled input/select value. */
    fill: (selector, value) =>
      page.evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); })()`,
      ),
    async screenshot(file, { clip, transparent = false } = {}) {
      if (transparent)
        await send('Emulation.setDefaultBackgroundColorOverride', {
          color: { r: 0, g: 0, b: 0, a: 0 },
        });
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        ...(clip && { clip: { ...clip, scale: 1 } }),
      });
      const buffer = Buffer.from(data, 'base64');
      if (file) writeFileSync(file, buffer);
      return buffer;
    },
    async register(username, password = 'super-secret-pw') {
      await page.goto('/login');
      const status = await page.evaluate(
        `fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: '${username}', email: '${username}@example.com', password: '${password}' }) }).then((r) => r.status)`,
      );
      if (status !== 201) throw new Error(`register ${username}: HTTP ${status}`);
    },
    close: () => browser.send('Target.closeTarget', { targetId }),
  };
  await page.viewport(width, height, mobile, scale);
  return page;
}

export { sleep };
