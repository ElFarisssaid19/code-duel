import cssTrack from './css.js';
import htmlTrack from './html.js';
import htmlCssTrack from './htmlCss.js';

/**
 * FRONTEND problems. Each one: { slug, title, difficulty, track, canvas: { width, height },
 * description (markdown), palette, fixedHtml (CSS track), starter: { html, css },
 * reference: { html, css }, matchThreshold? }. The seed renders `reference` to make the target
 * image, and checks it scores 100.00 against it.
 */
export default [...cssTrack, ...htmlTrack, ...htmlCssTrack];
