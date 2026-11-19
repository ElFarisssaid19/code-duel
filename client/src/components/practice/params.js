/**
 * Parameter names from the starter code's signature, e.g. ["nums", "target"]. The first
 * parenthesized group is the signature in both languages (`function f(a, b)` / `def f(a: int, b)`).
 */
export function paramNames(starterCode) {
  const match = /\(([^)]*)\)/.exec(starterCode ?? '');
  if (!match) return [];
  return match[1]
    .split(',')
    .map((p) => p.trim().split(/[:=\s]/)[0])
    .filter(Boolean);
}

const MAX_CHARS = 5000;

/** Compact JSON for display, truncated for very large values. */
export function formatValue(value) {
  const text = JSON.stringify(value) ?? 'undefined';
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)} … (${text.length} chars)` : text;
}
