import { createRandom } from '../random.js';

// Independent oracle: brute force over all subarrays (the reference uses prefix sums + a map).
function oracle(nums, k) {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length; j++) if ((sum += nums[j]) === k) count++;
  }
  return count;
}

const rand = createRandom(37);
const smallValues = Array.from({ length: 5000 }, () => rand.int(-5, 5));
const signs = Array.from({ length: 8000 }, () => rand.int(-1, 1));
const big = Array.from({ length: 3000 }, () => rand.int(-1000, 1000));

export default {
  slug: 'subarray-sum-equals-k',
  title: 'Subarray Sum Equals K',
  difficulty: 'MEDIUM',
  timeLimitMs: 2000,
  functionName: { javascript: 'subarraySum', python: 'subarray_sum' },
  starterCode: {
    javascript: `/**
 * @param {number[]} nums
 * @param {number} k
 * @return {number}
 */
function subarraySum(nums, k) {
  
}
`,
    python: `def subarray_sum(nums: list[int], k: int) -> int:
    pass
`,
  },
  description: `Given an array of integers \`nums\` and an integer \`k\`, return the number of **non-empty contiguous subarrays** whose elements add up to exactly \`k\`.

### Example 1

\`\`\`
Input:  nums = [1, 1, 1], k = 2
Output: 2
\`\`\`

\`[1, 1]\` appears twice (positions 0–1 and 1–2).

### Example 2

\`\`\`
Input:  nums = [1, 2, 3], k = 3
Output: 2
\`\`\`

\`[1, 2]\` and \`[3]\`.

### Constraints

- \`1 <= nums.length <= 2 * 10^4\`
- \`-1000 <= nums[i] <= 1000\`
- \`-10^7 <= k <= 10^7\`
- Values can be negative, so a sliding window doesn't work.
`,
  tests: [
    { input: [[1, 1, 1], 2], expected: 2 },
    { input: [[1, 2, 3], 3], expected: 2 },
    { hidden: true, input: [[1], 0], expected: 0 },
    { hidden: true, input: [[0], 0], expected: 1 },
    { hidden: true, input: [[0, 0, 0], 0], expected: 6 },
    { hidden: true, input: [[-1, -1, 1], 0], expected: 1 },
    { hidden: true, input: [[1, -1, 0], 0], expected: 3 },
    { hidden: true, input: [[3, 4, 7, 2, -3, 1, 4, 2], 7], expected: 4 },
    { hidden: true, input: [[1, 2, 1, 2, 1], 3], expected: 4 },
    { hidden: true, input: [smallValues, 3], expected: oracle(smallValues, 3) },
    { hidden: true, input: [signs, 0], expected: oracle(signs, 0) },
    { hidden: true, input: [big, 500], expected: oracle(big, 500) },
  ],
};
