/**
 * Captures the README media with headless Chrome against the running dev stack:
 *   docs/screenshots/{landing,arena,result,leaderboard,profile,practice,arena-mobile,frontend-practice}.png
 *   docs/demo.gif (a duel from "match found" to the result)
 *
 * It registers two fresh demo accounts and plays three real ranked duels (so the profile has an
 * ELO chart). Usage: `npm run infra:up && npm run dev`, then `npm run docs:capture`.
 * Needs Google Chrome (or CHROME_PATH) and ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import frontendProblems from '../../server/prisma/seed/frontend/index.js';
import { launchBrowser, sleep } from './browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const shots = join(root, 'docs/screenshots');
mkdirSync(shots, { recursive: true });
const shot = (page, name) =>
  page
    .screenshot(join(shots, `${name}.png`))
    .then(() => console.log(`✔ docs/screenshots/${name}.png`));
const solution = (slug) =>
  readFileSync(join(root, `server/prisma/seed/solutions/${slug}.js`), 'utf8');

const ARENA = `!!document.querySelector('.monaco-editor .view-lines') && !!document.querySelector('[role=timer]')`;
const IN_MATCH = `/^\\/match\\/\\d+$/.test(location.pathname)`;
const PLAYABLE = `[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Play ranked' && !b.disabled)`;
const RESULT = `!!document.querySelector('[data-testid=result-title]')`;

/**
 * "Types" code into the editor line by line through the dev-only window.__codeDuelEditor hook
 * (keyboard input would trigger Monaco's auto-indent and bracket auto-closing). Each change goes
 * through the app's normal onChange: autosave, "opponent is typing" pings.
 */
async function typeCode(page, code, { delayMs = 90 } = {}) {
  await page.waitFor('!!window.__codeDuelEditor', 'editor hook');
  const lines = code.trimEnd().split('\n');
  for (let i = 1; i <= lines.length; i++) {
    await page.evaluate(
      `(() => { const ed = window.__codeDuelEditor; ed.setValue(${JSON.stringify(lines.slice(0, i).join('\n'))}); const line = ed.getModel().getLineCount(); ed.setPosition({ lineNumber: line, column: ed.getModel().getLineMaxColumn(line) }); })()`,
    );
    await sleep(delayMs);
  }
}

async function problemSlug(page) {
  const title = await page.evaluate(
    `document.querySelector('section[aria-label=Problem] h1').textContent`,
  );
  const { problems } = await page.evaluate(`fetch('/api/problems').then((r) => r.json())`);
  return problems.find((p) => p.title === title).slug;
}

async function submit(page) {
  await page.click('Submit');
  await page.waitFor(
    `!document.querySelector('button[aria-busy=true]') && (document.querySelector('#arena-results h2')?.textContent ?? '') !== ''`,
    'submit result',
    30_000,
  );
}

/** Records JPEG frames of `page` until stop() is called. */
function recorder(page, dir) {
  let running = true;
  let count = 0;
  const loop = (async () => {
    while (running) {
      const started = Date.now();
      const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      writeFileSync(
        join(dir, `frame-${String(count++).padStart(4, '0')}.jpg`),
        Buffer.from(data, 'base64'),
      );
      await sleep(Math.max(0, 220 - (Date.now() - started)));
    }
  })();
  const t0 = Date.now();
  return {
    async stop() {
      running = false;
      await loop;
      return { frames: count, seconds: (Date.now() - t0) / 1000 };
    },
  };
}

const browser = await launchBrowser();
try {
  // 1. Landing page (logged out), mid-animation.
  const guest = await browser.newPage();
  await guest.goto('/');
  await guest.waitFor(`!!document.querySelector('[data-testid=public-stats]')`, 'landing');
  await sleep(6500);
  await shot(guest, 'landing');
  await guest.close();

  // 2. Two demo players, three ranked duels.
  const tag = Math.random().toString(36).slice(2, 5);
  const a = await browser.newPage({ width: 1280, height: 800 });
  const b = await browser.newPage({ width: 1280, height: 800 });
  await a.register(`nova_${tag}`);
  await b.register(`rook_${tag}`);
  const frames = mkdtempSync(join(tmpdir(), 'code-duel-gif-'));

  for (const round of [1, 2, 3]) {
    const winner = round === 3 ? b : a;
    const loser = winner === a ? b : a;
    for (const p of [a, b]) {
      await p.goto('/');
      await p.waitFor(PLAYABLE, 'play button');
    }
    await a.click('Play ranked');
    const rec = round === 1 ? recorder(a, frames) : null;
    await sleep(round === 1 ? 900 : 0); // show the "searching" state in the GIF
    await b.click('Play ranked');
    await a.waitFor(IN_MATCH, 'A in match');
    await b.waitFor(IN_MATCH, 'B in match');
    if (round === 3) await a.viewport(375, 812, true, 2);
    await a.waitFor(ARENA, 'A arena', 30_000);
    await b.waitFor(ARENA, 'B arena', 30_000);

    const slug = await problemSlug(winner);
    if (round === 3) {
      // Phone layout: switch to the editor tab.
      await a.evaluate(
        `[...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.startsWith('Editor')).click()`,
      );
      await sleep(400);
    }
    await typeCode(loser, `// first try\n${solution(slug).replace(/return /, 'return null && ')}`, {
      delayMs: 40,
    });
    if (round === 3) await shot(a, 'arena-mobile'); // A (phone) is the loser here: editor with code
    await submit(loser);
    await typeCode(winner, solution(slug), { delayMs: round === 1 ? 140 : 30 });
    if (round === 1) await shot(a, 'arena');
    await submit(winner);
    await a.waitFor(RESULT, 'A result', 15_000);
    await b.waitFor(RESULT, 'B result', 15_000);
    if (round === 1) {
      await sleep(1600); // confetti + modal animation
      const { frames: n, seconds } = await rec.stop();
      await shot(a, 'result');
      execFileSync('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        String(n / seconds),
        '-i',
        join(frames, 'frame-%04d.jpg'),
        '-vf',
        'fps=6,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
        '-loop',
        '0',
        join(root, 'docs/demo.gif'),
      ]);
      console.log(`✔ docs/demo.gif (${n} frames, ${seconds.toFixed(1)} s)`);
    }
    if (round === 3) await a.viewport(1280, 800);
  }
  rmSync(frames, { recursive: true, force: true });

  // 3. Leaderboard, profile with ELO chart (hover a point), practice page.
  await a.viewport(1440, 900);
  await a.goto('/leaderboard');
  await a.waitFor(`document.querySelectorAll('tbody tr').length >= 2`, 'leaderboard');
  await sleep(400);
  await shot(a, 'leaderboard');

  await a.goto(`/u/nova_${tag}`);
  await a.waitFor(
    `!!document.querySelector('svg[role=img]') && document.querySelectorAll('main ul li').length >= 3`,
    'profile',
  );
  const chart = await a.evaluate(
    `(() => { const r = document.querySelector('svg[role=img]').getBoundingClientRect(); return { x: r.x + r.width * 0.66, y: r.y + r.height / 2 }; })()`,
  );
  await a.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: chart.x, y: chart.y });
  await sleep(400);
  await shot(a, 'profile');

  await a.goto('/practice/two-sum');
  await a.waitFor(
    `!!document.querySelector('.monaco-editor .view-lines')`,
    'practice editor',
    30_000,
  );
  await typeCode(a, solution('two-sum'), { delayMs: 10 });
  await a.click('Run');
  await a.waitFor(
    `(document.querySelector('[aria-live] h2')?.textContent ?? '').startsWith('Accepted')`,
    'practice run',
    30_000,
  );
  await sleep(300);
  await shot(a, 'practice');

  // 4. Frontend practice: a partial solution (no green light) with the official diff.
  const traffic = frontendProblems.find((p) => p.slug === 'css-traffic-light');
  await a.goto('/practice/css-traffic-light');
  await a.waitFor(
    `!!window.__codeDuelEditor && !!document.querySelector('[data-testid=live-preview]')`,
    'frontend practice',
    30_000,
  );
  await typeCode(a, traffic.reference.css.replace(/\.green \{[^}]*\}\n/, ''), { delayMs: 10 });
  await sleep(3100); // practice rate limit (1 request / 3 s)
  await a.click('Submit');
  await a.waitFor(
    `!!document.querySelector('[data-testid=frontend-score]')`,
    'frontend score',
    30_000,
  );
  await a.click('Diff');
  await a.waitFor(`!!document.querySelector('[data-testid=diff-image]')`, 'diff image');
  await sleep(300);
  await shot(a, 'frontend-practice');

  const errors = [...a.errors, ...b.errors];
  if (errors.length) console.warn('Browser errors:\n', errors.join('\n'));
} finally {
  await browser.close();
}
