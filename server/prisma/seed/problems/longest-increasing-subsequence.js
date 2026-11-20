import { crossCheck } from '../oracleCheck.js';
import { createRandom } from '../random.js';

const brute = (nums) => {
  const dp = nums.map(() => 1);
  let best = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < i; j++) if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
    best = Math.max(best, dp[i]);
  }
  return best;
};

// Fast oracle: Fenwick tree of best lengths over compressed values (the reference solutions use
// patience sorting with binary search).
function oracle(nums) {
  const values = [...new Set(nums)].sort((a, b) => a - b);
  const rank = new Map(values.map((v, i) => [v, i + 1]));
  const tree = new Int32Array(values.length + 1);
  let best = 0;
  for (const x of nums) {
    const r = rank.get(x);
    let prev = 0;
    for (let j = r - 1; j > 0; j -= j & -j) prev = Math.max(prev, tree[j]); // best ending below x
    const length = prev + 1;
    for (let j = r; j <= values.length; j += j & -j) tree[j] = Math.max(tree[j], length);
    best = Math.max(best, length);
  }
  return best;
}

crossCheck('longest-increasing-subsequence', {
  fast: oracle,
  brute,
  generate: (rand) => [Array.from({ length: rand.int(1, 60) }, () => rand.int(-10, 10))],
});

const rand = createRandom(57);
const mid = Array.from({ length: 2000 }, () => rand.int(-1_000_000, 1_000_000));
const random = Array.from({ length: 100_000 }, () => rand.int(-1_000_000_000, 1_000_000_000));
const increasing = Array.from({ length: 100_000 }, (_, i) => i * 3 - 100_000);
const smallRange = Array.from({ length: 100_000 }, () => rand.int(0, 1000));

export default {
  slug: 'longest-increasing-subsequence',
  title: 'Longest Increasing Subsequence',
  difficulty: 'HARD',
  timeLimitMs: 2000,
  functionName: { javascript: 'lengthOfLIS', python: 'length_of_lis' },
  starterCode: {
    javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function lengthOfLIS(nums) {
  
}
`,
    python: `def length_of_lis(nums: list[int]) -> int:
    pass
`,
  },
  description: `Given an array \`nums\`, return the length of its longest **strictly increasing subsequence**. A subsequence keeps the original order but can skip elements.

### Example 1

\`\`\`
Input:  nums = [10, 9, 2, 5, 3, 7, 101, 18]
Output: 4
\`\`\`

One longest subsequence is \`[2, 3, 7, 101]\`.

### Example 2

\`\`\`
Input:  nums = [0, 1, 0, 3, 2, 3]
Output: 4
\`\`\`

### Constraints

- \`1 <= nums.length <= 10^5\`
- \`-10^9 <= nums[i] <= 10^9\`

**Note:** the classic O(n²) dynamic programming is too slow for 10^5 elements. Aim for O(n log n).
`,
  tests: [
    { input: [[10, 9, 2, 5, 3, 7, 101, 18]], expected: 4 },
    { input: [[0, 1, 0, 3, 2, 3]], expected: 4 },
    { hidden: true, input: [[7, 7, 7, 7]], expected: 1 },
    { hidden: true, input: [[5]], expected: 1 },
    { hidden: true, input: [[1, 2, 3, 4, 5]], expected: 5 },
    { hidden: true, input: [[5, 4, 3, 2, 1]], expected: 1 },
    { hidden: true, input: [[-2, -1]], expected: 2 },
    { hidden: true, input: [[4, 10, 4, 3, 8, 9]], expected: 3 },
    { hidden: true, input: [mid], expected: brute(mid) },
    { hidden: true, input: [random], expected: oracle(random) },
    { hidden: true, input: [increasing], expected: 100_000 },
    { hidden: true, input: [smallRange], expected: oracle(smallRange) },
  ],
};
