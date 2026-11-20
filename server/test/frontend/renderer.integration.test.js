/**
 * Renderer integration tests: against the REAL renderer container (Chromium headless shell).
 * Needs `npm run infra:up`.
 */
import { describe, expect, it } from 'vitest';
import {
  compareWithTarget,
  RenderFailedError,
  renderPage,
} from '../../src/services/renderer/index.js';
import { FRONTEND, referencePage } from '../frontendFixtures.js';

const traffic = FRONTEND['css-traffic-light'];
const recipe = FRONTEND['html-recipe-page'];

async function targetOf(p) {
  return renderPage(referencePage(p));
}

async function score(p, targetPng, page = {}) {
  return compareWithTarget({ ...referencePage(p), ...page, targetPng });
}

describe('renderer (real container)', () => {
  it('renders deterministically: the reference scores exactly 100.00 against its own target', async () => {
    for (const p of [traffic, recipe, FRONTEND['ui-pricing-card']]) {
      const target = await targetOf(p);
      expect(target.subarray(1, 4).toString()).toBe('PNG');
      expect((await score(p, target)).score, p.slug).toBe(100);
    }
  });

  it('a blank page scores low (0 after normalization), the raw pixel ratio is still reported', async () => {
    const target = await targetOf(traffic);
    const blank = await score(traffic, target, { css: '' });
    expect(blank.score).toBe(0);
    expect(blank.rawScore).toBeLessThan(5);
    expect(blank.differentPixels).toBe(blank.blankDifferentPixels);

    // Sparse page: without normalization an empty page would get ~98 %.
    const recipeTarget = await targetOf(recipe);
    const empty = await score(recipe, recipeTarget, { html: '' });
    expect(empty.score).toBe(0);
    expect(empty.rawScore).toBeGreaterThan(95);
  });

  it('a partial solution lands in between and gets a diff image', async () => {
    const target = await targetOf(traffic);
    const partial = await score(traffic, target, {
      css: traffic.reference.css.replace(/\.green \{[^}]*\}/, ''), // no green light
    });
    expect(partial.score).toBeGreaterThan(50);
    expect(partial.score).toBeLessThan(99.5);
    expect(partial.diffPng.subarray(1, 4).toString()).toBe('PNG');
  });

  it('a <script> that would paint the page red has no effect (JavaScript disabled + stripped)', async () => {
    const target = await targetOf(traffic);
    const evil = await score(traffic, target, {
      html: `${traffic.fixedHtml}<script>document.body.innerHTML = ''; document.documentElement.style.background = 'red';</script>`,
    });
    expect(evil.score).toBe(100);
    expect(evil.removed).toContain('script');

    const breakout = await score(traffic, target, {
      css: `${traffic.reference.css}</style><script>document.body.style.background = 'red'</script><style>`,
    });
    expect(breakout.score).toBe(100);

    const handlers = await score(traffic, target, {
      html: `<div onclick="x()" class="light" onmouseover="y()"><div class="red"></div><div class="amber"></div><div class="green"></div></div>`,
    });
    expect(handlers.score).toBe(100);
    expect(handlers.removed).toEqual(expect.arrayContaining(['@onclick', '@onmouseover']));
  });

  it('blocks every network request: an external background-image or @import never loads', async () => {
    const target = await targetOf(traffic);
    const external = await score(traffic, target, {
      css: `@import url("https://example.com/evil.css");\n${traffic.reference.css}\nbody { background-image: url("https://example.com/red.png"); }`,
    });
    expect(external.score).toBe(100);
    const frames = await score(traffic, target, {
      html: `${traffic.fixedHtml}<iframe src="https://example.com"></iframe><img src="https://example.com/x.png" width="400" height="300">`,
    });
    expect(frames.removed).toContain('iframe');
    // The <img> stays in the page but can't load: only its small broken-image box differs.
    expect(frames.score).toBeGreaterThan(90);
  });

  it('a page that renders too slowly fails cleanly with RENDER_TIMEOUT after 5 s', async () => {
    const started = Date.now();
    const slow = renderPage({
      html: '<i></i>'.repeat(2500),
      css: 'i{position:absolute;inset:0;filter:blur(80px) drop-shadow(0 0 60px red);background:conic-gradient(red,blue,red)}',
      width: 600,
      height: 400,
    });
    await expect(slow).rejects.toBeInstanceOf(RenderFailedError);
    await expect(slow).rejects.toMatchObject({ code: 'RENDER_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(8000);
    // The renderer is still fine afterwards.
    expect((await score(traffic, await targetOf(traffic))).score).toBe(100);
  }, 20_000);

  it('rejects code over 20 KB', async () => {
    await expect(
      renderPage({ html: 'x'.repeat(20 * 1024 + 1), css: '', width: 400, height: 300 }),
    ).rejects.toMatchObject({ code: 'CODE_TOO_LARGE' });
  });
});
