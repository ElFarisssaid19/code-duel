import { crossCheck } from '../oracleCheck.js';
import { createRandom } from '../random.js';

const brute = (nums) => {
  let count = 0;
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++) if (nums[i] > nums[j]) count++;
  return count;
};

// Fast oracle: Fenwick tree over compressed values (the reference solutions use merge sort).
function oracle(nums) {
  const values = [...new Set(nums)].sort((a, b) => a - b);
  const rank = new Map(values.map((v, i) => [v, i + 1]));
  const tree = new Int32Array(values.length + 1);
  let count = 0;
  for (let i = nums.length - 1; i >= 0; i--) {
    const r = rank.get(nums[i]);
    for (let j = r - 1; j > 0; j -= j & -j) count += tree[j]; // smaller values to the right
    for (let j = r; j <= values.length; j += j & -j) tree[j]++;
  }
  return count;
}

crossCheck('count-inversions', {
  fast: oracle,
  brute,
  generate: (rand) => [Array.from({ length: rand.int(0, 60) }, () => rand.int(-5, 5))],
});

const rand = createRandom(51);
const mid = Array.from({ length: 2000 }, () => rand.int(0, 1000));
const random = Array.from({ length: 100_000 }, () => rand.int(0, 1_000_000_000));
const descending = Array.from({ length: 100_000 }, (_, i) => 100_000 - i);
const fewValues = Array.from({ length: 100_000 }, () => rand.int(0, 10));

export default {
  slug: 'count-inversions',
  title: 'Count Inversions',
  difficulty: 'HARD',
  timeLimitMs: 2000,
  functionName: { javascript: 'countInversions', python: 'count_inversions' },
  starterCode: {
    javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function countInversions(nums) {
  
}
`,
    python: `def count_inversions(nums: list[int]) -> int:
    pass
`,
  },
  description: `An **inversion** in an array is a pair of positions \`i < j\` with \`nums[i] > nums[j]\`. It measures how far the array is from being sorted.

Given \`nums\`, return the number of inversions.

### Example 1

\`\`\`
Input:  nums = [2, 4, 1, 3, 5]
Output: 3
\`\`\`

The inversions are (2, 1), (4, 1) and (4, 3).

### Example 2

\`\`\`
Input:  nums = [5, 4, 3, 2, 1]
Output: 10
\`\`\`

### Constraints

- \`1 <= nums.length <= 10^5\`
- \`0 <= nums[i] <= 10^9\`
- Equal values are **not** an inversion.
- The answer can exceed 2^31 (but fits in a 64-bit float exactly).

**Note:** checking every pair is O(n²), far too slow for 10^5 elements. Aim for O(n log n).
`,
  tests: [
    { input: [[2, 4, 1, 3, 5]], expected: 3 },
    { input: [[5, 4, 3, 2, 1]], expected: 10 },
    { hidden: true, input: [[1]], expected: 0 },
    { hidden: true, input: [[1, 2, 3]], expected: 0 },
    { hidden: true, input: [[2, 2, 2]], expected: 0 },
    { hidden: true, input: [[3, 1, 2, 1]], expected: 4 },
    { hidden: true, input: [[1, 3, 2, 3, 1]], expected: 4 },
    { hidden: true, input: [[1_000_000_000, 0]], expected: 1 },
    { hidden: true, input: [mid], expected: brute(mid) },
    { hidden: true, input: [random], expected: oracle(random) },
    { hidden: true, input: [descending], expected: (100_000 * 99_999) / 2 },
    { hidden: true, input: [fewValues], expected: oracle(fewValues) },
  ],
};
