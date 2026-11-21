/** MEDIUM · numbers sorted as strings (JS default sort; Python key=str). */
export default {
  slug: 'debug-top-three',
  title: 'Top Three Scores',
  difficulty: 'MEDIUM',
  bugCount: 1,
  timeLimitMs: 1000,
  functionName: { javascript: 'topThree', python: 'top_three' },
  description: `Return the **three highest scores**, highest first (fewer if there are fewer than three scores).

A player who scored 100 shows up below a player who scored 9.`,
  buggy: {
    javascript: `function topThree(scores) {
  const ordered = [...scores].sort().reverse();
  return ordered.slice(0, 3);
}
`,
    python: `def top_three(scores):
    ordered = sorted(scores, key=str, reverse=True)
    return ordered[:3]
`,
  },
  fixed: {
    javascript: `function topThree(scores) {
  const ordered = [...scores].sort((a, b) => b - a);
  return ordered.slice(0, 3);
}
`,
    python: `def top_three(scores):
    ordered = sorted(scores, reverse=True)
    return ordered[:3]
`,
  },
  tests: [
    { input: [[100, 9, 25, 7]], expected: [100, 25, 9] },
    { input: [[3, 1, 2]], expected: [3, 2, 1] },
    { input: [[5]], expected: [5], hidden: true },
    { input: [[]], expected: [], hidden: true },
    { input: [[10, 2, 30]], expected: [30, 10, 2], hidden: true },
    { input: [[1000, 999, 98, 97]], expected: [1000, 999, 98], hidden: true },
    { input: [[8, 80, 800]], expected: [800, 80, 8], hidden: true },
    { input: [[11, 9, 100]], expected: [100, 11, 9], hidden: true },
  ],
};
