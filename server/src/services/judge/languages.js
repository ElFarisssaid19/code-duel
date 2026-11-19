/**
 * Supported languages. The harness (entryFile) wraps the user's code (solutionFile).
 * How each language is actually executed is provider-specific (see providers/).
 */
export const LANGUAGES = Object.freeze({
  javascript: { label: 'JavaScript', entryFile: 'main.js', solutionFile: 'solution.js' },
  python: { label: 'Python', entryFile: 'main.py', solutionFile: 'solution.py' },
});

export const LANGUAGE_IDS = Object.keys(LANGUAGES);
