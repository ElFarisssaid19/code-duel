// Independent oracle: walk with a direction vector and a visited grid (the reference shrinks
// four boundaries).
function oracle(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const seen = matrix.map((row) => row.map(() => false));
  const dirs = [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ];
  const out = [];
  let [r, c, d] = [0, 0, 0];
  for (let step = 0; step < rows * cols; step++) {
    out.push(matrix[r][c]);
    seen[r][c] = true;
    let [nr, nc] = [r + dirs[d][0], c + dirs[d][1]];
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || seen[nr][nc]) {
      d = (d + 1) % 4;
      [nr, nc] = [r + dirs[d][0], c + dirs[d][1]];
    }
    [r, c] = [nr, nc];
  }
  return out;
}

const grid = (rows, cols) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => r * cols + c + 1));
const large = grid(100, 100);
const wide = grid(3, 1000);
const tall = grid(1000, 2);

export default {
  slug: 'spiral-matrix',
  title: 'Spiral Matrix',
  difficulty: 'MEDIUM',
  timeLimitMs: 2000,
  functionName: { javascript: 'spiralOrder', python: 'spiral_order' },
  starterCode: {
    javascript: `/**
 * @param {number[][]} matrix
 * @return {number[]}
 */
function spiralOrder(matrix) {
  
}
`,
    python: `def spiral_order(matrix: list[list[int]]) -> list[int]:
    pass
`,
  },
  description: `Given an \`m x n\` matrix, return all of its elements in **spiral order**: start at the top-left corner, go right, then down, then left, then up, and keep turning clockwise towards the center.

### Example 1

\`\`\`
Input:  matrix = [[1, 2, 3],
                  [4, 5, 6],
                  [7, 8, 9]]
Output: [1, 2, 3, 6, 9, 8, 7, 4, 5]
\`\`\`

### Example 2

\`\`\`
Input:  matrix = [[1, 2, 3, 4],
                  [5, 6, 7, 8],
                  [9, 10, 11, 12]]
Output: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]
\`\`\`

### Constraints

- \`1 <= m, n\` and \`m * n <= 10^4\`
- \`-100 <= matrix[i][j] <= 10^4\`
`,
  tests: [
    {
      input: [
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      ],
      expected: [1, 2, 3, 6, 9, 8, 7, 4, 5],
    },
    {
      input: [
        [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
          [9, 10, 11, 12],
        ],
      ],
      expected: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7],
    },
    { hidden: true, input: [[[7]]], expected: [7] },
    { hidden: true, input: [[[1, 2, 3]]], expected: [1, 2, 3] },
    { hidden: true, input: [[[1], [2], [3]]], expected: [1, 2, 3] },
    {
      hidden: true,
      input: [
        [
          [1, 2],
          [3, 4],
        ],
      ],
      expected: [1, 2, 4, 3],
    },
    {
      hidden: true,
      input: [
        [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
      ],
      expected: [1, 2, 4, 6, 5, 3],
    },
    { hidden: true, input: [grid(2, 5)], expected: oracle(grid(2, 5)) },
    { hidden: true, input: [grid(5, 2)], expected: oracle(grid(5, 2)) },
    {
      hidden: true,
      input: [
        [
          [-1, 0],
          [0, -100],
        ],
      ],
      expected: [-1, 0, -100, 0],
    },
    { hidden: true, input: [large], expected: oracle(large) },
    { hidden: true, input: [wide], expected: oracle(wide) },
    { hidden: true, input: [tall], expected: oracle(tall) },
  ],
};
