/**
 * Regenerates the favicon set and the Open Graph image:
 *   client/public/{favicon-16x16,favicon-32x32,apple-touch-icon,icon-192,icon-512,icon-maskable-512}.png
 *   client/public/favicon.ico
 *   client/public/og-image.png (1200×630, screenshot of the dev-only /og route)
 *
 * Usage: npm run dev (in another terminal), then `npm run docs:icons`.
 * Needs Google Chrome (or CHROME_PATH) and ImageMagick (`magick`) for the .ico.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';

const pub = (name) => fileURLToPath(new URL(`../../client/public/${name}`, import.meta.url));

const svgPage = (svg, size) =>
  `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)}`;

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ width: 512, height: 512 });
  const favicon = readFileSync(pub('favicon.svg'), 'utf8');
  const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#07090f"/><path d="M28.5 21 18 32l10.5 11" fill="none" stroke="#34eaa2" stroke-width="5" stroke-linecap="square"/><path d="m35.5 21 10.5 11-10.5 11" fill="none" stroke="#52bcff" stroke-width="5" stroke-linecap="square"/></svg>`;
  const targets = [
    ['favicon-16x16.png', favicon, 16],
    ['favicon-32x32.png', favicon, 32],
    ['apple-touch-icon.png', favicon, 180],
    ['icon-192.png', favicon, 192],
    ['icon-512.png', favicon, 512],
    ['icon-maskable-512.png', maskable, 512],
  ];
  for (const [file, svg, size] of targets) {
    await page.viewport(size, size);
    await page.goto(svgPage(svg, size));
    await page.screenshot(pub(file), {
      clip: { x: 0, y: 0, width: size, height: size },
      transparent: true,
    });
    console.log(`✔ ${file}`);
  }
  execFileSync('magick', [pub('favicon-16x16.png'), pub('favicon-32x32.png'), pub('favicon.ico')]);
  console.log('✔ favicon.ico');

  const og = await browser.newPage({ width: 1200, height: 630 });
  await og.goto('/og');
  await og.waitFor(
    `document.fonts.status === 'loaded' && !!document.querySelector('h1')`,
    'OG layout',
  );
  await new Promise((r) => setTimeout(r, 500));
  await og.screenshot(pub('og-image.png'), { clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log('✔ og-image.png (1200×630)');
} finally {
  await browser.close();
}
