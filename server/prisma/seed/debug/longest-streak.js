/** HARD · variable shadowing (JS block-scoped redeclaration; Python shadows the max() builtin) + off-by-one. */
export default {
  slug: 'debug-longest-streak',
  title: 'Longest Streak',
  difficulty: 'HARD',
  bugCount: 2,
  timeLimitMs: 1000,
  functionName: { javascript: 'longestStreak', python: 'longest_streak' },
  description: `Return the length of the **longest run of equal consecutive values**. An empty list has a
longest streak of \`0\`, and a single value is a streak of \`1\`.

There are **2 bugs**: one in how a run starts, one in how the best run is remembered.`,
  buggy: {
    javascript: `function longestStreak(values) {
  let best = 0;
  let current = 0;
  for (let i = 0; i < values.length; i++) {
    if (i > 0 && values[i] === values[i - 1]) {
      current++;
    } else {
      current = 0;
    }
    if (current > best) {
      let best = current;
    }
  }
  return best;
}
`,
    python: `def longest_streak(values):
    max = 0
    current = 0
    for i in range(len(values)):
        if i > 0 and values[i] == values[i - 1]:
            current += 1
        else:
            current = 0
        max = max(max, current)
    return max
`,
  },
  fixed: {
    javascript: `function longestStreak(values) {
  let best = 0;
  let current = 0;
  for (let i = 0; i < values.length; i++) {
    if (i > 0 && values[i] === values[i - 1]) {
      current++;
    } else {
      current = 1;
    }
    if (current > best) {
      best = current;
    }
  }
  return best;
}
`,
    python: `def longest_streak(values):
    best = 0
    current = 0
    for i in range(len(values)):
        if i > 0 and values[i] == values[i - 1]:
            current += 1
        else:
            current = 1
        best = max(best, current)
    return best
`,
  },
  tests: [
    { input: [[1, 1, 2, 2, 2, 3]], expected: 3 },
    { input: [[5]], expected: 1 },
    { input: [[]], expected: 0, hidden: true },
    { input: [[7, 7, 7, 7]], expected: 4, hidden: true },
    { input: [[1, 2, 3]], expected: 1, hidden: true },
    { input: [[4, 4, 1, 4, 4, 4, 4, 2]], expected: 4, hidden: true },
    { input: [['a', 'a', 'b']], expected: 2, hidden: true },
    { input: [[0, 1, 1, 0, 0, 0]], expected: 3, hidden: true },
  ],
};
