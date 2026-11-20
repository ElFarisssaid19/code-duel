import { createRandom } from '../random.js';

// Independent oracle: breadth-first search over amounts (the reference is a bottom-up DP).
function oracle(coins, amount) {
  const dist = new Int32Array(amount + 1).fill(-1);
  dist[0] = 0;
  const queue = [0];
  for (let head = 0; head < queue.length; head++) {
    const value = queue[head];
    if (value === amount) return dist[value];
    for (const coin of coins) {
      const next = value + coin;
      if (next <= amount && dist[next] === -1) {
        dist[next] = dist[value] + 1;
        queue.push(next);
      }
    }
  }
  return dist[amount];
}

const rand = createRandom(41);
const randomCoins = [...new Set(Array.from({ length: 8 }, () => rand.int(5, 500)))];

export default {
  slug: 'coin-change',
  title: 'Coin Change',
  difficulty: 'MEDIUM',
  timeLimitMs: 2000,
  functionName: { javascript: 'coinChange', python: 'coin_change' },
  starterCode: {
    javascript: `/**
 * @param {number[]} coins
 * @param {number} amount
 * @return {number}
 */
function coinChange(coins, amount) {
  
}
`,
    python: `def coin_change(coins: list[int], amount: int) -> int:
    pass
`,
  },
  description: `You are given coin denominations \`coins\` (you have an unlimited number of each) and a target \`amount\`.

Return the **fewest coins** that add up to exactly \`amount\`, or \`-1\` if it can't be done. An amount of \`0\` needs \`0\` coins.

### Example 1

\`\`\`
Input:  coins = [1, 2, 5], amount = 11
Output: 3
\`\`\`

11 = 5 + 5 + 1.

### Example 2

\`\`\`
Input:  coins = [2], amount = 3
Output: -1
\`\`\`

### Constraints

- \`1 <= coins.length <= 12\`
- \`1 <= coins[i] <= 10^4\`, all distinct
- \`0 <= amount <= 10^4\`

**Note:** greedily taking the largest coin first doesn't always give the minimum.
`,
  tests: [
    { input: [[1, 2, 5], 11], expected: 3 },
    { input: [[2], 3], expected: -1 },
    { hidden: true, input: [[1], 0], expected: 0 },
    { hidden: true, input: [[1], 1], expected: 1 },
    { hidden: true, input: [[2], 1], expected: -1 },
    { hidden: true, input: [[1, 2, 5], 100], expected: 20 },
    { hidden: true, input: [[5, 10], 3], expected: -1 },
    { hidden: true, input: [[1, 3, 4], 6], expected: 2 }, // greedy (4+1+1) gives 3
    {
      hidden: true,
      input: [[186, 419, 83, 408], 6249],
      expected: oracle([186, 419, 83, 408], 6249),
    },
    { hidden: true, input: [[7], 14], expected: 2 },
    { hidden: true, input: [randomCoins, 10_000], expected: oracle(randomCoins, 10_000) },
    { hidden: true, input: [[9973, 9967], 9999], expected: -1 },
    { hidden: true, input: [[1, 10_000], 9999], expected: 9999 },
  ],
};
