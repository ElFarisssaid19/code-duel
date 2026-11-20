/**
 * The live preview's document. Mirrors the renderer's canvas document
 * (infra/renderer/src/document.js): BASE_CSS must stay identical (a server test checks it), so
 * the preview matches the official render as closely as a different browser allows.
 *
 * The preview runs in <iframe sandbox="" srcdoc>: no scripts, opaque origin. The CSP below also
 * blocks every network request (only inline styles and data: images are allowed).
 */
export const BASE_CSS =
  'html{font-family:"DejaVu Sans",Verdana,sans-serif;overflow:hidden}' +
  'code,kbd,pre,samp{font-family:"DejaVu Sans Mono",Menlo,Consolas,monospace}';

export const PREVIEW_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** What the renderer renders for a track: the CSS track uses the fixed HTML, HTML has no CSS. */
export function pageForTrack(problem, { html, css }) {
  return {
    html: problem.track === 'CSS' ? (problem.fixedHtml ?? '') : html,
    css: problem.track === 'HTML' ? '' : css,
  };
}

export function buildPreviewDocument({ html = '', css = '' }) {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">` +
    `<style>${BASE_CSS}</style>` +
    (css ? `<style>${css}</style>` : '') +
    `</head><body>${html}</body></html>`
  );
}
