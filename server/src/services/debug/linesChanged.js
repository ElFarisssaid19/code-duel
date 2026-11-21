/**
 * DEBUG "lines changed": how many lines a player edited compared to the buggy code.
 *
 * Line diff (longest common subsequence), then for each run of consecutive changes ("hunk")
 * count max(lines removed, lines added): editing one line = 1, adding a line = 1, replacing two
 * lines with three = 3. Trailing whitespace, Windows line endings and trailing blank lines are
 * ignored; indentation counts (it matters in Python).
 *
 * The client has an identical copy (client/src/lib/linesChanged.js) for the live counter; a
 * server test checks both give the same results.
 */
const MAX_CELLS = 4_000_000; // 2000 × 2000 lines; above that, fall back to a cheap estimate

function normalize(code) {
  const lines = String(code ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();
  return lines;
}

export function linesChanged(original, edited) {
  const a = normalize(original);
  const b = normalize(edited);

  // Common prefix and suffix never count.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const x = a.slice(start, endA);
  const y = b.slice(start, endB);
  const n = x.length;
  const m = y.length;
  if (n === 0 || m === 0) return Math.max(n, m);
  if (n * m > MAX_CELLS) return Math.max(n, m);

  // lcs[i][j] = LCS length of x[i:] and y[j:], flattened.
  const width = m + 1;
  const lcs = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        x[i] === y[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }

  // Walk the diff; each hunk of consecutive removals/additions counts max(removed, added).
  let total = 0;
  let removed = 0;
  let added = 0;
  const closeHunk = () => {
    total += Math.max(removed, added);
    removed = 0;
    added = 0;
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      closeHunk();
      i += 1;
      j += 1;
    } else if (j < m && (i === n || lcs[i * width + j + 1] >= lcs[(i + 1) * width + j])) {
      added += 1;
      j += 1;
    } else {
      removed += 1;
      i += 1;
    }
  }
  closeHunk();
  return total;
}
