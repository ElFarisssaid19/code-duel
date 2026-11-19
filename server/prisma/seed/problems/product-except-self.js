import { createRandom } from '../random.js';

// Independent oracle: brute force O(n²). Normalizes -0 to 0 (JSON has no negative zero).
const oracle = (nums) =>
  nums.map((_, i) => nums.reduce((product, x, j) => (j === i ? product : product * x), 1) || 0);

// Values in {-1, 1} with a few 2s so the products stay well inside 32-bit range.
function largeCase(seed, withZero) {
  const rand = createRandom(seed);
  const nums = Array.from({ length: 3000 }, () => (rand.next() < 0.5 ? -1 : 1));
  for (let k = 0; k < 10; k++) nums[rand.int(0, nums.length - 1)] = 2;
  if (withZero) nums[rand.int(0, nums.length - 1)] = 0;
  return nums;
}

const large = largeCase(11, false);
const largeZero = largeCase(12, true);

export default {
  slug: 'product-except-self',
  title: 'Product of Array Except Self',
  difficulty: 'MEDIUM',
  timeLimitMs: 2000,
  functionName: { javascript: 'productExceptSelf', python: 'product_except_self' },
  starterCode: {
    javascript: `/**
 * @param {number[]} nums
 * @return {number[]}
 */
function productExceptSelf(nums) {
  
}
`,
    python: `def product_except_self(nums: list[int]) -> list[int]:
    pass
`,
  },
  description: `Given an integer array \`nums\`, return an array \`answer\` where \`answer[i]\` is the product of all the elements of \`nums\` **except** \`nums[i]\`.

Every product fits in a 32-bit signed integer.

### Example 1

\`\`\`
Input:  nums = [1, 2, 3, 4]
Output: [24, 12, 8, 6]
\`\`\`

### Example 2

\`\`\`
Input:  nums = [-1, 1, 0, -3, 3]
Output: [0, 0, 9, 0, 0]
\`\`\`

### Constraints

- \`2 <= nums.length <= 10^4\`
- \`-30 <= nums[i] <= 30\`

**Challenge:** solve it in O(n) time **without** using division.
`,
  tests: [
    { input: [[1, 2, 3, 4]], expected: [24, 12, 8, 6] },
    { input: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0] },
    { hidden: true, input: [[2, 3]], expected: [3, 2] },
    { hidden: true, input: [[0, 0]], expected: [0, 0] },
    { hidden: true, input: [[0, 4, 5]], expected: [20, 0, 0] },
    { hidden: true, input: [[1, 1, 1, 1, 1]], expected: [1, 1, 1, 1, 1] },
    { hidden: true, input: [[-2, -3, 4]], expected: [-12, -8, 6] },
    { hidden: true, input: [[30, -30, 1, 2]], expected: [-60, 60, -1800, -900] },
    { hidden: true, input: [large], expected: oracle(large) },
    { hidden: true, input: [largeZero], expected: oracle(largeZero) },
  ],
};
