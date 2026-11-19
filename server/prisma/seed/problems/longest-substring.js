import { createRandom } from '../random.js';

// Independent oracle: from each start, extend until a character repeats. Inputs use a small
// alphabet, so each scan is short.
function oracle(s) {
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    const seen = new Set();
    let j = i;
    while (j < s.length && !seen.has(s[j])) seen.add(s[j++]);
    best = Math.max(best, j - i);
  }
  return best;
}

const randomString = (seed, length, alphabet) => {
  const rand = createRandom(seed);
  return Array.from({ length }, () => alphabet[rand.int(0, alphabet.length - 1)]).join('');
};

const letters = 'abcdefghijklmnopqrstuvwxyz';
const large = randomString(7, 50_000, letters);
const printable = randomString(
  8,
  20_000,
  `${letters}ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !?.,;:-_`,
);

export default {
  slug: 'longest-substring-without-repeating',
  title: 'Longest Substring Without Repeats',
  difficulty: 'MEDIUM',
  timeLimitMs: 2000,
  functionName: { javascript: 'lengthOfLongestSubstring', python: 'length_of_longest_substring' },
  starterCode: {
    javascript: `/**
 * @param {string} s
 * @return {number}
 */
function lengthOfLongestSubstring(s) {
  
}
`,
    python: `def length_of_longest_substring(s: str) -> int:
    pass
`,
  },
  description: `Given a string \`s\`, return the length of the **longest substring** (a contiguous run of characters) that contains no repeated character.

### Example 1

\`\`\`
Input:  s = "abcabcbb"
Output: 3
\`\`\`

The longest such substring is \`"abc"\`.

### Example 2

\`\`\`
Input:  s = "bbbbb"
Output: 1
\`\`\`

### Constraints

- \`0 <= s.length <= 5 * 10^4\`
- \`s\` consists of printable ASCII characters (letters, digits, symbols and spaces).

**Hint:** an O(n²) scan is too slow for the largest inputs.
`,
  tests: [
    { input: ['abcabcbb'], expected: 3 },
    { input: ['bbbbb'], expected: 1 },
    { hidden: true, input: [''], expected: 0 },
    { hidden: true, input: [' '], expected: 1 },
    { hidden: true, input: ['pwwkew'], expected: 3 },
    { hidden: true, input: ['dvdf'], expected: 3 },
    { hidden: true, input: ['abba'], expected: 2 },
    { hidden: true, input: ['tmmzuxt'], expected: 5 },
    { hidden: true, input: [letters.repeat(2000)], expected: 26 },
    { hidden: true, input: [large], expected: oracle(large) },
    { hidden: true, input: [printable], expected: oracle(printable) },
  ],
};
