import { crossCheck } from '../oracleCheck.js';
import { createRandom } from '../random.js';

const brute = (heights) => {
  let best = 0;
  for (let i = 0; i < heights.length; i++) {
    let min = Infinity;
    for (let j = i; j < heights.length; j++) {
      min = Math.min(min, heights[j]);
      best = Math.max(best, min * (j - i + 1));
    }
  }
  return best;
};

// Fast oracle: nearest smaller bar on each side with pointer jumping (the reference solutions
// use a monotonic stack).
function oracle(heights) {
  const n = heights.length;
  const left = new Int32Array(n);
  const right = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let p = i - 1;
    while (p >= 0 && heights[p] >= heights[i]) p = left[p];
    left[i] = p;
  }
  for (let i = n - 1; i >= 0; i--) {
    let p = i + 1;
    while (p < n && heights[p] >= heights[i]) p = right[p];
    right[i] = p;
  }
  let best = 0;
  for (let i = 0; i < n; i++) best = Math.max(best, heights[i] * (right[i] - left[i] - 1));
  return best;
}

crossCheck('largest-rectangle', {
  fast: oracle,
  brute,
  generate: (rand) => [Array.from({ length: rand.int(1, 60) }, () => rand.int(0, 8))],
});

const rand = createRandom(53);
const mid = Array.from({ length: 2000 }, () => rand.int(0, 10_000));
const random = Array.from({ length: 100_000 }, () => rand.int(0, 10_000));
const increasing = Array.from({ length: 100_000 }, (_, i) => i + 1);
const flat = Array.from({ length: 100_000 }, () => 7);

export default {
  slug: 'largest-rectangle-in-histogram',
  title: 'Largest Rectangle in Histogram',
  difficulty: 'HARD',
  timeLimitMs: 2000,
  functionName: { javascript: 'largestRectangleArea', python: 'largest_rectangle_area' },
  starterCode: {
    javascript: `/**
 * @param {number[]} heights
 * @return {number}
 */
function largestRectangleArea(heights) {
  
}
`,
    python: `def largest_rectangle_area(heights: list[int]) -> int:
    pass
`,
  },
  description: `\`heights\` describes a histogram: bar \`i\` has width 1 and height \`heights[i]\`, and the bars stand side by side.

Return the area of the **largest rectangle** that fits entirely inside the histogram.

### Example 1

\`\`\`
Input:  heights = [2, 1, 5, 6, 2, 3]
Output: 10
\`\`\`

The bars of height 5 and 6 hold a 5 × 2 rectangle.

### Example 2

\`\`\`
Input:  heights = [2, 4]
Output: 4
\`\`\`

### Constraints

- \`1 <= heights.length <= 10^5\`
- \`0 <= heights[i] <= 10^5\`

**Note:** trying every pair of edges is O(n²), too slow for 10^5 bars. Aim for O(n).
`,
  tests: [
    { input: [[2, 1, 5, 6, 2, 3]], expected: 10 },
    { input: [[2, 4]], expected: 4 },
    { hidden: true, input: [[0]], expected: 0 },
    { hidden: true, input: [[5]], expected: 5 },
    { hidden: true, input: [[1, 1, 1, 1]], expected: 4 },
    { hidden: true, input: [[2, 1, 2]], expected: 3 },
    { hidden: true, input: [[4, 2, 0, 3, 2, 5]], expected: 6 },
    { hidden: true, input: [[6, 7, 5, 2, 4, 5, 9, 3]], expected: 16 },
    { hidden: true, input: [mid], expected: brute(mid) },
    { hidden: true, input: [random], expected: oracle(random) },
    { hidden: true, input: [increasing], expected: 50_000 * 50_001 },
    { hidden: true, input: [flat], expected: 700_000 },
  ],
};
