/**
 * Builds the canvas document a submission is rendered in. The client's live preview builds the
 * same document (client/src/lib/frontendCanvas.js); a server test checks that BASE_CSS matches.
 *
 * The base styles only pin the fonts (installed in the image, so renders are deterministic) and
 * hide overflow. Everything else is the browser's default stylesheet.
 */
export const BASE_CSS =
  'html{font-family:"DejaVu Sans",Verdana,sans-serif;overflow:hidden}' +
  'code,kbd,pre,samp{font-family:"DejaVu Sans Mono",Menlo,Consolas,monospace}';

/** Full HTML document: base styles, the player's CSS, then the player's HTML in <body>. */
export function buildDocument({ html = '', css = '' }) {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<style>${BASE_CSS}</style>` +
    (css ? `<style>${css}</style>` : '') +
    `</head><body>${html}</body></html>`
  );
}
