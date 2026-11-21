/**
 * The public share page (GET /s/:shareId): Open Graph + Twitter tags with ABSOLUTE URLs (from
 * APP_URL), the card image and a "Play Code Duel" button. Every piece of user content is
 * escaped. No code, no test data.
 */
import { escapeHtml as e } from './escape.js';

export function buildSharePage(summary, { shareId, appUrl }) {
  const pageUrl = `${appUrl}/s/${shareId}`;
  const image = (format) => `${appUrl}/api/share/${shareId}/card.png?format=${format}`;
  const title = `${summary.outcome}: @${summary.me.username} vs ${summary.opponent.badge === 'bot' ? 'Bot ' : summary.opponent.badge === 'ghost' ? 'the ghost of @' : '@'}${summary.opponent.username} · Code Duel`;
  const description = `${summary.mode} · ${summary.category} · ${summary.problem} (${summary.difficulty}). ${summary.reason}. ${summary.stat}.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Code Duel">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(pageUrl)}">
<meta property="og:image" content="${e(image('og'))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(`${summary.outcome} on ${summary.problem}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(description)}">
<meta name="twitter:image" content="${e(image('og'))}">
<link rel="icon" href="${e(appUrl)}/favicon.svg" type="image/svg+xml">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:24px 16px;background:#07090f;color:#eef1f7;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
img{display:block;width:100%;max-width:960px;height:auto;border-radius:16px;border:1px solid #2c3448}
h1{margin:0;font-size:1.25rem;text-align:center;font-weight:600}
p{margin:0;color:#a7b0c8;text-align:center;max-width:40rem}
a.play{display:inline-flex;align-items:center;justify-content:center;height:48px;padding:0 28px;border-radius:10px;background:#14cf89;color:#07090f;font-weight:700;text-decoration:none}
a.play:hover{background:#34eaa2}
a.play:focus-visible{outline:2px solid #34eaa2;outline-offset:3px}
</style>
</head>
<body>
<main style="display:contents">
<img src="${e(image('og'))}" width="1200" height="630" alt="${e(`Result card: ${summary.outcome}, ${summary.me.username} vs ${summary.opponent.username} on ${summary.problem}`)}">
<h1>${e(title)}</h1>
<p>${e(description)}</p>
<a class="play" href="${e(appUrl)}/">Play Code Duel</a>
</main>
</body>
</html>`;
}
