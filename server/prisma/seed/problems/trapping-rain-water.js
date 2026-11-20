import { crossCheck } from '../oracleCheck.js';
import { createRandom } from '../random.js';

const brute = (height) => {
  let water = 0;
  for (let i = 0; i < height.length; i++) {
    let left = 0;
    let right = 0;
    for (let j = 0; j <= i; j++) left = Math.max(left, height[j]);
    for (let j = i; j < height.length; j++) right = Math.max(right, height[j]);
    water += Math.min(left, right) - height[i];
  }
  return water;
};

// Fast oracle: prefix and suffix maximum arrays (the reference solutions use two pointers).
function oracle(height) {
  const n = height.length;
  const leftMax = new Array(n);
  const rightMax = new Array(n);
  for (let i = 0; i < n; i++) leftMax[i] = Math.max(height[i], i > 0 ? leftMax[i - 1] : 0);
  for (let i = n - 1; i >= 0; i--)
    rightMax[i] = Math.max(height[i], i < n - 1 ? rightMax[i + 1] : 0);
  let water = 0;
  for (let i = 0; i < n; i++) water += Math.min(leftMax[i], rightMax[i]) - height[i];
  return water;
}

crossCheck('trapping-rain-water', {
  fast: oracle,
  brute,
  generate: (rand) => [Array.from({ length: rand.int(1, 60) }, () => rand.int(0, 9))],
});

const rand = createRandom(59);
const mid = Array.from({ length: 2000 }, () => rand.int(0, 100_000));
const random = Array.from({ length: 100_000 }, () => rand.int(0, 100_000));
const valley = [100_000, ...Array.from({ length: 99_998 }, () => 0), 100_000];
const mountain = Array.from({ length: 100_000 }, (_, i) => Math.min(i, 99_999 - i));

export default {
  slug: 'trapping-rain-water',
  title: 'Trapping Rain Water',
  difficulty: 'HARD',
  timeLimitMs: 2000,
  functionName: { javascript: 'trap', python: 'trap' },
  starterCode: {
    javascript: `/**
 * @param {number[]} height
 * @return {number}
 */
function trap(height) {
  
}
`,
    python: `def trap(height: list[int]) -> int:
    pass
`,
  },
  description: `\`height\` is an elevation map: bar \`i\` has width 1 and height \`height[i]\`. After it rains, water collects in the dips between taller bars.

Return the **total units of water** trapped.

### Example 1

\`\`\`
Input:  height = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]
Output: 6
\`\`\`

### Example 2

\`\`\`
Input:  height = [4, 2, 0, 3, 2, 5]
Output: 9
\`\`\`

### Constraints

- \`1 <= height.length <= 10^5\`
- \`0 <= height[i] <= 10^5\`

**Note:** scanning left and right from every bar is O(n²), too slow for 10^5 bars. Aim for O(n).
`,
  tests: [
    { input: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], expected: 6 },
    { input: [[4, 2, 0, 3, 2, 5]], expected: 9 },
    { hidden: true, input: [[5]], expected: 0 },
    { hidden: true, input: [[1, 2]], expected: 0 },
    { hidden: true, input: [[3, 0, 3]], expected: 3 },
    { hidden: true, input: [[5, 4, 3, 2, 1]], expected: 0 },
    { hidden: true, input: [[1, 2, 3, 4, 5]], expected: 0 },
    { hidden: true, input: [[2, 0, 2, 0, 2]], expected: 4 },
    { hidden: true, input: [[5, 0, 0, 0, 0, 5]], expected: 20 },
    { hidden: true, input: [mid], expected: brute(mid) },
    { hidden: true, input: [random], expected: oracle(random) },
    { hidden: true, input: [valley], expected: 100_000 * 99_998 },
    { hidden: true, input: [mountain], expected: 0 },
  ],
};
