/** EASY · state shared between calls (Python mutable default argument; JS module-level state). */
export default {
  slug: 'debug-unique-words',
  title: 'First Occurrences',
  difficulty: 'EASY',
  bugCount: 1,
  timeLimitMs: 1000,
  functionName: { javascript: 'uniqueWords', python: 'unique_words' },
  description: `Return the words in order, **keeping only the first occurrence** of each word.

The function works the first time it is called, then starts dropping words that were never
repeated. Every call must be independent.`,
  buggy: {
    javascript: `const seen = new Set();

function uniqueWords(words) {
  const result = [];
  for (const word of words) {
    if (!seen.has(word)) {
      seen.add(word);
      result.push(word);
    }
  }
  return result;
}
`,
    python: `def unique_words(words, seen=set()):
    result = []
    for word in words:
        if word not in seen:
            seen.add(word)
            result.append(word)
    return result
`,
  },
  fixed: {
    javascript: `function uniqueWords(words) {
  const seen = new Set();
  const result = [];
  for (const word of words) {
    if (!seen.has(word)) {
      seen.add(word);
      result.push(word);
    }
  }
  return result;
}
`,
    python: `def unique_words(words, seen=None):
    if seen is None:
        seen = set()
    result = []
    for word in words:
        if word not in seen:
            seen.add(word)
            result.append(word)
    return result
`,
  },
  tests: [
    { input: [['a', 'b', 'a']], expected: ['a', 'b'] },
    { input: [['b', 'c', 'b']], expected: ['b', 'c'] },
    { input: [['x']], expected: ['x'], hidden: true },
    { input: [['x', 'y']], expected: ['x', 'y'], hidden: true },
    { input: [[]], expected: [], hidden: true },
    { input: [['z', 'z', 'z']], expected: ['z'], hidden: true },
    { input: [['y', 'z', 'w']], expected: ['y', 'z', 'w'], hidden: true },
    { input: [['q', 'x']], expected: ['q', 'x'], hidden: true },
  ],
};
