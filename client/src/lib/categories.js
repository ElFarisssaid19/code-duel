/** Problem categories and FRONTEND tracks, with their labels. */
export const CATEGORIES = [
  { id: 'ALGO', label: 'Algorithms', short: 'Algo' },
  { id: 'FRONTEND', label: 'Frontend', short: 'Front' },
  { id: 'DEBUG', label: 'Debug', short: 'Debug' },
];

export const CATEGORY_LABELS = { ALGO: 'Algorithms', FRONTEND: 'Frontend', DEBUG: 'Debug' };

export const TRACKS = [
  { id: 'HTML', label: 'HTML' },
  { id: 'CSS', label: 'CSS' },
  { id: 'HTML_CSS', label: 'HTML + CSS' },
];

export const TRACK_LABELS = { HTML: 'HTML', CSS: 'CSS', HTML_CSS: 'HTML + CSS' };

/** Submission.language → label (frontend submissions store the track, lowercased). */
export const LANGUAGE_LABELS = {
  javascript: 'JavaScript',
  python: 'Python',
  html: 'HTML',
  css: 'CSS',
  html_css: 'HTML + CSS',
};

export const isCategory = (value) => CATEGORIES.some((c) => c.id === value);

export const formatScore = (score) => `${Number(score ?? 0).toFixed(2)}%`;

/** "1 bug" / "3 bugs" */
export const bugsLabel = (n) => `${n} bug${n === 1 ? '' : 's'}`;

/** "1 line" / "3 lines" */
export const linesLabel = (n) => `${n} line${n === 1 ? '' : 's'}`;
