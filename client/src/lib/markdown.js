import DOMPurify from 'dompurify';
import { marked } from 'marked';

/** Markdown → sanitized HTML (problem statements are ours, but never trust stored HTML). */
export function renderMarkdown(markdown) {
  return DOMPurify.sanitize(marked.parse(markdown ?? '', { gfm: true, async: false }));
}
