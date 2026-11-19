import { createRandom } from '../random.js';

// Independent oracle (brute force) for generated tests.
function oracle(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) if (nums[i] + nums[j] === target) return [i, j];
  }
  throw new Error('no solution');
}

// 10,000 numbers with exactly one valid pair: every other value is a multiple of 4, the pair
// is ≡ 1 (mod 4), so no other pair can reach the target (≡ 2 mod 4).
function largeCase() {
  const rand = createRandom(1);
  const nums = rand.shuffle(Array.from({ length: 9998 }, (_, k) => (k - 5000) * 4));
  const a = 4 * 123_457 + 1;
  const b = -4 * 98_765 + 1;
  nums.splice(rand.int(0, nums.length), 0, a);
  nums.splice(rand.int(0, nums.length), 0, b);
  return [nums, a + b];
}

const large = largeCase();

export default {
  slug: 'two-sum',
  title: 'Two Sum',
  difficulty: 'EASY',
  timeLimitMs: 2000,
  functionName: { javascript: 'twoSum', python: 'two_sum' },
  starterCode: {
    javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  
}
`,
    python: `def two_sum(nums: list[int], target: int) -> list[int]:
    pass
`,
  },
  description: `Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers that add up to \`target\`.

Each input has **exactly one** solution, and you may not use the same element twice. Return the two indices in **increasing order**.

### Example 1

\`\`\`
Input:  nums = [2, 7, 11, 15], target = 9
Output: [0, 1]
\`\`\`

\`nums[0] + nums[1] == 9\`, so the answer is \`[0, 1]\`.

### Example 2

\`\`\`
Input:  nums = [3, 2, 4], target = 6
Output: [1, 2]
\`\`\`

### Constraints

- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i], target <= 10^9\`
- Exactly one valid answer exists.

**Follow-up:** can you do better than O(n²)?
`,
  tests: [
    { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
    { input: [[3, 2, 4], 6], expected: [1, 2] },
    { hidden: true, input: [[3, 3], 6], expected: [0, 1] },
    { hidden: true, input: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
    { hidden: true, input: [[0, 4, 3, 0], 0], expected: [0, 3] },
    { hidden: true, input: [[1, 5, 1_000_000_000, -1_000_000_000], 0], expected: [2, 3] },
    { hidden: true, input: [[5, 75, 25], 100], expected: [1, 2] },
    { hidden: true, input: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 19], expected: [8, 9] },
    { hidden: true, input: large, expected: oracle(...large) },
  ],
};
