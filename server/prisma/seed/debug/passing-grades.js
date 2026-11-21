/** EASY · wrong comparison operator. */
export default {
  slug: 'debug-passing-grades',
  title: 'Passing Grades',
  difficulty: 'EASY',
  bugCount: 1,
  timeLimitMs: 1000,
  functionName: { javascript: 'countPassing', python: 'count_passing' },
  description: `Count how many scores **pass**. A score passes when it is **at least** \`passMark\`.

A student who scores exactly the pass mark is complaining that they failed.`,
  buggy: {
    javascript: `function countPassing(scores, passMark) {
  let count = 0;
  for (const score of scores) {
    if (score > passMark) count++;
  }
  return count;
}
`,
    python: `def count_passing(scores, pass_mark):
    count = 0
    for score in scores:
        if score > pass_mark:
            count += 1
    return count
`,
  },
  fixed: {
    javascript: `function countPassing(scores, passMark) {
  let count = 0;
  for (const score of scores) {
    if (score >= passMark) count++;
  }
  return count;
}
`,
    python: `def count_passing(scores, pass_mark):
    count = 0
    for score in scores:
        if score >= pass_mark:
            count += 1
    return count
`,
  },
  tests: [
    { input: [[40, 50, 60], 50], expected: 2 },
    { input: [[90, 10], 50], expected: 1 },
    { input: [[], 50], expected: 0, hidden: true },
    { input: [[50, 50, 50], 50], expected: 3, hidden: true },
    { input: [[49, 51], 50], expected: 1, hidden: true },
    { input: [[100], 100], expected: 1, hidden: true },
    { input: [[0, 1, 2], 0], expected: 3, hidden: true },
    { input: [[70, 80, 49], 70], expected: 2, hidden: true },
  ],
};
