import { thresholdOf } from './scoring.js';
import { EDITABLE, TRACK_RULES } from './trackRules.js';

export const targetImageUrl = (slug) => `/api/problems/${slug}/target.png`;

/** What players see of a FRONTEND problem. Never the reference solution. */
export function publicFrontendProblem(p) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    category: 'FRONTEND',
    track: p.track,
    description: p.description,
    starterCode: p.starterCode,
    canvas: { width: p.canvasWidth, height: p.canvasHeight },
    palette: p.palette,
    fixedHtml: p.track === 'CSS' ? p.fixedHtml : null,
    threshold: thresholdOf(p),
    editable: EDITABLE[p.track],
    trackRules: TRACK_RULES[p.track],
    targetImageUrl: targetImageUrl(p.slug),
  };
}
