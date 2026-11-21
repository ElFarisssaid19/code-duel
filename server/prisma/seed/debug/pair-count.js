/** MEDIUM · wrong inner loop bounds (self-pairs and double counting). */
export default {
  slug: 'debug-pair-count',
  title: 'Pairs With Sum',
  difficulty: 'MEDIUM',
  bugCount: 1,
  timeLimitMs: 1000,
  functionName: { javascript: 'countPairs', python: 'count_pairs' },
  description: `Count the pairs of positions \`i < j\` such that \`nums[i] + nums[j] === target\`.

The count is always too high.`,
  buggy: {
    javascript: `function countPairs(nums, target) {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) count++;
    }
  }
  return count;
}
`,
    python: `def count_pairs(nums, target):
    count = 0
    for i in range(len(nums)):
        for j in range(len(nums)):
            if nums[i] + nums[j] == target:
                count += 1
    return count
`,
  },
  fixed: {
    javascript: `function countPairs(nums, target) {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) count++;
    }
  }
  return count;
}
`,
    python: `def count_pairs(nums, target):
    count = 0
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                count += 1
    return count
`,
  },
  tests: [
    { input: [[1, 2, 3, 4], 5], expected: 2 },
    { input: [[1, 1, 1], 2], expected: 3 },
    { input: [[], 0], expected: 0, hidden: true },
    { input: [[5], 10], expected: 0, hidden: true },
    { input: [[2, 2], 4], expected: 1, hidden: true },
    { input: [[0, 0, 0, 0], 0], expected: 6, hidden: true },
    { input: [[1, 9, 5, 5], 10], expected: 2, hidden: true },
    { input: [[3, 4, 7], 100], expected: 0, hidden: true },
  ],
};
