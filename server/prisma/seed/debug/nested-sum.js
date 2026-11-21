/** HARD · missing return in a helper + a loop that skips the first element. */
export default {
  slug: 'debug-nested-sum',
  title: 'Nested Sum',
  difficulty: 'HARD',
  bugCount: 2,
  timeLimitMs: 1000,
  functionName: { javascript: 'nestedSum', python: 'nested_sum' },
  description: `Return the **sum of every number** in a nested list. Items are numbers or lists (nested to any depth).
An empty list sums to \`0\`.

There are **2 bugs**.`,
  buggy: {
    javascript: `function nestedSum(items) {
  let total = 0;
  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    if (Array.isArray(item)) {
      total += sumList(item);
    } else {
      total += item;
    }
  }
  return total;
}

function sumList(list) {
  nestedSum(list);
}
`,
    python: `def nested_sum(items):
    total = 0
    for i in range(1, len(items)):
        item = items[i]
        if isinstance(item, list):
            total += sum_list(item)
        else:
            total += item
    return total


def sum_list(lst):
    nested_sum(lst)
`,
  },
  fixed: {
    javascript: `function nestedSum(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (Array.isArray(item)) {
      total += sumList(item);
    } else {
      total += item;
    }
  }
  return total;
}

function sumList(list) {
  return nestedSum(list);
}
`,
    python: `def nested_sum(items):
    total = 0
    for i in range(len(items)):
        item = items[i]
        if isinstance(item, list):
            total += sum_list(item)
        else:
            total += item
    return total


def sum_list(lst):
    return nested_sum(lst)
`,
  },
  tests: [
    { input: [[1, [2, 3], 4]], expected: 10 },
    { input: [[[1, [2]], [3]]], expected: 6 },
    { input: [[]], expected: 0, hidden: true },
    { input: [[5]], expected: 5, hidden: true },
    { input: [[[[[7]]]]], expected: 7, hidden: true },
    { input: [[1, 2, 3]], expected: 6, hidden: true },
    { input: [[[], [1], [[2, 3]]]], expected: 6, hidden: true },
    { input: [[-1, [1]]], expected: 0, hidden: true },
  ],
};
