import { createRandom } from '../random.js';

// Independent oracle: mark covered points on a line with doubled coordinates (so intervals
// that only touch, like [1, 4] and [4, 5], merge, while [1, 2] and [3, 4] stay apart), then
// read back the covered runs.
function oracle(intervals) {
  const max = Math.max(...intervals.map(([, end]) => end));
  const covered = new Uint8Array(2 * max + 2);
  for (const [start, end] of intervals) covered.fill(1, 2 * start, 2 * end + 1);
  const merged = [];
  for (let p = 0; p < covered.length; p++) {
    if (covered[p] && !covered[p - 1]) merged.push([p / 2, null]);
    if (covered[p] && !covered[p + 1]) merged.at(-1)[1] = p / 2;
  }
  return merged;
}

function largeCase(seed) {
  const rand = createRandom(seed);
  return Array.from({ length: 3000 }, () => {
    const start = rand.int(0, 9900);
    return [start, start + rand.int(0, 25)];
  });
}

const large = largeCase(21);

export default {
  slug: 'merge-intervals',
  title: 'Merge Intervals',
  difficulty: 'MEDIUM',
  timeLimitMs: 2000,
  functionName: { javascript: 'merge', python: 'merge' },
  starterCode: {
    javascript: `/**
 * @param {number[][]} intervals
 * @return {number[][]}
 */
function merge(intervals) {
  
}
`,
    python: `def merge(intervals: list[list[int]]) -> list[list[int]]:
    pass
`,
  },
  description: `Given an array of \`intervals\` where \`intervals[i] = [start, end]\`, merge all overlapping intervals and return the resulting non-overlapping intervals **sorted by start**.

Intervals that only touch (like \`[1, 4]\` and \`[4, 5]\`) count as overlapping.

### Example 1

\`\`\`
Input:  intervals = [[1, 3], [2, 6], [8, 10], [15, 18]]
Output: [[1, 6], [8, 10], [15, 18]]
\`\`\`

\`[1, 3]\` and \`[2, 6]\` overlap, so they merge into \`[1, 6]\`.

### Example 2

\`\`\`
Input:  intervals = [[1, 4], [4, 5]]
Output: [[1, 5]]
\`\`\`

### Constraints

- \`1 <= intervals.length <= 10^4\`
- \`0 <= start <= end <= 10^4\`
- The input is **not** necessarily sorted.
`,
  tests: [
    {
      input: [
        [
          [1, 3],
          [2, 6],
          [8, 10],
          [15, 18],
        ],
      ],
      expected: [
        [1, 6],
        [8, 10],
        [15, 18],
      ],
    },
    {
      input: [
        [
          [1, 4],
          [4, 5],
        ],
      ],
      expected: [[1, 5]],
    },
    { hidden: true, input: [[[1, 4]]], expected: [[1, 4]] },
    {
      hidden: true,
      input: [
        [
          [1, 4],
          [0, 4],
        ],
      ],
      expected: [[0, 4]],
    },
    {
      hidden: true,
      input: [
        [
          [1, 4],
          [2, 3],
        ],
      ],
      expected: [[1, 4]],
    },
    {
      hidden: true,
      input: [
        [
          [5, 6],
          [1, 2],
          [3, 4],
        ],
      ],
      expected: [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
    },
    {
      hidden: true,
      input: [
        [
          [1, 10],
          [2, 3],
          [4, 5],
          [11, 12],
        ],
      ],
      expected: [
        [1, 10],
        [11, 12],
      ],
    },
    {
      hidden: true,
      input: [
        [
          [0, 0],
          [0, 0],
        ],
      ],
      expected: [[0, 0]],
    },
    {
      hidden: true,
      input: [
        [
          [2, 3],
          [4, 5],
          [6, 7],
          [8, 9],
          [1, 10],
        ],
      ],
      expected: [[1, 10]],
    },
    { hidden: true, input: [large], expected: oracle(large) },
  ],
};
