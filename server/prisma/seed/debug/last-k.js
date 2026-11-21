/** EASY · off-by-one in a slice. */
export default {
  slug: 'debug-last-k',
  title: 'Last K Items',
  difficulty: 'EASY',
  bugCount: 1,
  timeLimitMs: 1000,
  functionName: { javascript: 'lastK', python: 'last_k' },
  description: `Return the **last \`k\` items** of the list, in their original order.

- \`0 ≤ k ≤ length\`. When \`k\` is 0, return an empty list.

This code returns one item too many. Find the bug.`,
  buggy: {
    javascript: `function lastK(items, k) {
  return items.slice(items.length - k - 1);
}
`,
    python: `def last_k(items, k):
    return items[len(items) - k - 1:]
`,
  },
  fixed: {
    javascript: `function lastK(items, k) {
  return items.slice(items.length - k);
}
`,
    python: `def last_k(items, k):
    return items[len(items) - k:]
`,
  },
  tests: [
    { input: [[1, 2, 3, 4, 5], 2], expected: [4, 5] },
    { input: [['a', 'b', 'c'], 3], expected: ['a', 'b', 'c'] },
    { input: [[7], 1], expected: [7], hidden: true },
    { input: [[1, 2, 3], 0], expected: [], hidden: true },
    { input: [[5, 6, 7, 8], 1], expected: [8], hidden: true },
    { input: [[9, 8, 7, 6, 5, 4], 4], expected: [7, 6, 5, 4], hidden: true },
    { input: [[0, 0, 1], 2], expected: [0, 1], hidden: true },
    { input: [[3, 1, 2], 3], expected: [3, 1, 2], hidden: true },
  ],
};
