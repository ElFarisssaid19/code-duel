import { createRandom } from '../random.js';

// Independent oracle: sort, then scan runs (the reference uses a hash set).
function oracle(nums) {
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

const rand = createRandom(31);
const dense = Array.from({ length: 100_000 }, () => rand.int(-60_000, 60_000));
const permutation = rand.shuffle(Array.from({ length: 100_000 }, (_, i) => i - 50_000));
const sparse = Array.from({ length: 50_000 }, () => rand.int(-1_000_000_000, 1_000_000_000));

export default {
  slug: 'longest-consecutive-sequence',
  title: 'Longest Consecutive Sequence',
  difficulty: 'MEDIUM',
  timeLimitMs: 2000,
  functionName: { javascript: 'longestConsecutive', python: 'longest_consecutive' },
  starterCode: {
    javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function longestConsecutive(nums) {
  
}
`,
    python: `def longest_consecutive(nums: list[int]) -> int:
    pass
`,
  },
  description: `Given an unsorted array of integers \`nums\`, return the length of the longest run of **consecutive integers** (like \`4, 5, 6, 7\`) whose values all appear in \`nums\`. Their positions in the array don't matter.

### Example 1

\`\`\`
Input:  nums = [100, 4, 200, 1, 3, 2]
Output: 4
\`\`\`

The longest consecutive run is \`[1, 2, 3, 4]\`.

### Example 2

\`\`\`
Input:  nums = [0, 3, 7, 2, 5, 8, 4, 6, 0, 1]
Output: 9
\`\`\`

### Constraints

- \`0 <= nums.length <= 10^5\`
- \`-10^9 <= nums[i] <= 10^9\`
- Duplicates may appear (they count once).

**Challenge:** sorting takes O(n log n). Can you do it in O(n)?
`,
  tests: [
    { input: [[100, 4, 200, 1, 3, 2]], expected: 4 },
    { input: [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], expected: 9 },
    { hidden: true, input: [[]], expected: 0 },
    { hidden: true, input: [[1]], expected: 1 },
    { hidden: true, input: [[1, 1, 1]], expected: 1 },
    { hidden: true, input: [[1, 2, 0, 1]], expected: 3 },
    { hidden: true, input: [[-1, -2, -3, 10]], expected: 3 },
    { hidden: true, input: [[1, 3, 5, 7]], expected: 1 },
    { hidden: true, input: [[1_000_000_000, -1_000_000_000, 0, 999_999_999]], expected: 2 },
    { hidden: true, input: [dense], expected: oracle(dense) },
    { hidden: true, input: [permutation], expected: 100_000 },
    { hidden: true, input: [sparse], expected: oracle(sparse) },
  ],
};
