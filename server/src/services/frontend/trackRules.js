/**
 * FRONTEND track rules, enforced on every submission (practice and duels):
 *
 *   HTML      HTML only. No CSS at all: no `css` field, no <style>, no style="…", no <link>.
 *   CSS       The problem's fixed HTML is used; players send CSS only.
 *   HTML_CSS  Both, freely.
 *
 * For every track, embedded raster images (data:image/png…) and base64 data: URIs are refused:
 * the target image is public, so pasting it would be a free 100%. And CSS can't contain
 * "</style>" (it would escape its <style> element).
 */
export class TrackRuleError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'TrackRuleError';
    this.field = field;
  }
}

export const TRACK_RULES = {
  HTML: 'Write HTML only. CSS is not allowed: no <style> element, no style attribute, no <link>. The page uses the browser default styles.',
  CSS: 'The HTML is given and read-only. Write CSS only.',
  HTML_CSS: 'Write HTML and CSS freely.',
};

/** Which editors the player gets for each track. */
export const EDITABLE = {
  HTML: { html: true, css: false },
  CSS: { html: false, css: true },
  HTML_CSS: { html: true, css: true },
};

const STYLE_ELEMENT = /<style[\s>/]/i;
const LINK_ELEMENT = /<link[\s>/]/i;
const STYLE_ATTRIBUTE = /<[a-z][^>]*?\sstyle\s*=/i;
const RASTER_DATA_URI = /data:\s*image\/(?!svg\+xml)/i;
const BASE64_DATA_URI = /;\s*base64\s*,/i;
const STYLE_CLOSE = /<\/style/i;

function decoded(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function checkNoEmbeddedImages(field, text) {
  for (const candidate of [text, decoded(text)]) {
    if (RASTER_DATA_URI.test(candidate) || BASE64_DATA_URI.test(candidate)) {
      throw new TrackRuleError(
        field,
        'Embedded images (data:image/png, base64 data URIs) are not allowed: reproduce the target with HTML and CSS.',
      );
    }
  }
}

/**
 * Validates { html, css } for a track and returns what to render: { html, css } (the CSS track
 * renders the problem's fixed HTML). Throws TrackRuleError with a clear message.
 */
export function applyTrackRules(problem, { html = '', css = '' }) {
  const { track } = problem;
  const editable = EDITABLE[track];
  if (!editable) throw new Error(`Unknown track ${track}`);

  if (!editable.css && css.trim()) {
    throw new TrackRuleError('css', 'The HTML track does not allow CSS: send HTML only.');
  }
  if (!editable.html && html.trim()) {
    throw new TrackRuleError('html', 'The CSS track has a fixed HTML: send CSS only.');
  }
  if (track === 'HTML') {
    if (STYLE_ELEMENT.test(html))
      throw new TrackRuleError(
        'html',
        'The HTML track does not allow CSS: remove the <style> element.',
      );
    if (STYLE_ATTRIBUTE.test(html))
      throw new TrackRuleError(
        'html',
        'The HTML track does not allow CSS: remove the style attributes.',
      );
    if (LINK_ELEMENT.test(html))
      throw new TrackRuleError('html', 'The HTML track does not allow <link> elements.');
  }
  if (STYLE_CLOSE.test(css)) throw new TrackRuleError('css', 'CSS cannot contain "</style>".');
  if (editable.html) checkNoEmbeddedImages('html', html);
  if (editable.css) checkNoEmbeddedImages('css', css);

  const written = (editable.html ? html : '') + (editable.css ? css : '');
  if (!written.trim()) {
    throw new TrackRuleError(editable.html ? 'html' : 'css', 'Write some code before submitting.');
  }
  return {
    html: track === 'CSS' ? (problem.fixedHtml ?? '') : html,
    css: editable.css ? css : '',
  };
}

/** Characters the player wrote (whitespace excluded, so formatting isn't penalized). */
export function charCount(problem, { html = '', css = '' }) {
  const editable = EDITABLE[problem.track];
  const written = (editable.html ? html : '') + (editable.css ? css : '');
  return written.replace(/\s+/g, '').length;
}

/** Stored as Submission.language for FRONTEND submissions. */
export const trackLanguage = (track) => track.toLowerCase();
