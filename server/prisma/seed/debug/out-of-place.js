/** MEDIUM · sorting mutates (and aliases) the input. */
export default {
  slug: 'debug-out-of-place',
  title: 'Out of Place',
  difficulty: 'MEDIUM',
  bugCount: 1,
  timeLimitMs: 1000,
  functionName: { javascript: 'outOfPlace', python: 'out_of_place' },
  description: `Students line up by height. Return how many positions hold a **different height** than they
would if the line were sorted in **ascending** order.

The function always answers 0. Find out why.`,
  buggy: {
    javascript: `function outOfPlace(heights) {
  const sorted = heights.sort((a, b) => a - b);
  let count = 0;
  for (let i = 0; i < heights.length; i++) {
    if (heights[i] !== sorted[i]) count++;
  }
  return count;
}
`,
    python: `def out_of_place(heights):
    ordered = heights
    ordered.sort()
    count = 0
    for i in range(len(heights)):
        if heights[i] != ordered[i]:
            count += 1
    return count
`,
  },
  fixed: {
    javascript: `function outOfPlace(heights) {
  const sorted = [...heights].sort((a, b) => a - b);
  let count = 0;
  for (let i = 0; i < heights.length; i++) {
    if (heights[i] !== sorted[i]) count++;
  }
  return count;
}
`,
    python: `def out_of_place(heights):
    ordered = sorted(heights)
    count = 0
    for i in range(len(heights)):
        if heights[i] != ordered[i]:
            count += 1
    return count
`,
  },
  tests: [
    { input: [[1, 1, 4, 2, 1, 3]], expected: 3 },
    { input: [[5, 1, 2, 3, 4]], expected: 5 },
    { input: [[]], expected: 0, hidden: true },
    { input: [[1, 2, 3]], expected: 0, hidden: true },
    { input: [[3, 2, 1]], expected: 2, hidden: true },
    { input: [[2, 1]], expected: 2, hidden: true },
    { input: [[1, 3, 2, 4]], expected: 2, hidden: true },
    { input: [[10, 10, 1]], expected: 2, hidden: true },
  ],
};
