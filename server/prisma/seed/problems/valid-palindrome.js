const oracle = (s) => {
  const chars = [...s.toLowerCase()].filter((c) => /[a-z0-9]/.test(c));
  return chars.join('') === chars.reverse().join('');
};

const longPalindrome = `${'ab1'.repeat(10_000)}X${'1ba'.repeat(10_000)}`;
const longAlmost = `${'ab1'.repeat(10_000)}XY${'1ba'.repeat(10_000)}`;

export default {
  slug: 'valid-palindrome',
  title: 'Valid Palindrome',
  difficulty: 'EASY',
  timeLimitMs: 2000,
  functionName: { javascript: 'isPalindrome', python: 'is_palindrome' },
  starterCode: {
    javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isPalindrome(s) {
  
}
`,
    python: `def is_palindrome(s: str) -> bool:
    pass
`,
  },
  description: `A phrase is a **palindrome** if, after converting all uppercase letters to lowercase and removing every character that is not a letter or a digit, it reads the same forward and backward.

Given a string \`s\`, return \`true\` if it is a palindrome, or \`false\` otherwise.

### Example 1

\`\`\`
Input:  s = "A man, a plan, a canal: Panama"
Output: true
\`\`\`

After cleaning, \`"amanaplanacanalpanama"\` reads the same both ways.

### Example 2

\`\`\`
Input:  s = "race a car"
Output: false
\`\`\`

### Constraints

- \`0 <= s.length <= 10^5\`
- \`s\` contains only printable ASCII characters. Letters are \`a-z\`/\`A-Z\` and digits are \`0-9\`.
- An empty string (after cleaning) is a palindrome.
`,
  tests: [
    { input: ['A man, a plan, a canal: Panama'], expected: true },
    { input: ['race a car'], expected: false },
    { hidden: true, input: [' '], expected: true },
    { hidden: true, input: [''], expected: true },
    { hidden: true, input: ['0P'], expected: false },
    { hidden: true, input: ['ab_a'], expected: true },
    { hidden: true, input: ["No 'x' in Nixon"], expected: true },
    { hidden: true, input: ['Was it a car or a cat I saw?'], expected: true },
    { hidden: true, input: ['abcdba'], expected: false },
    { hidden: true, input: [longPalindrome], expected: oracle(longPalindrome) },
    { hidden: true, input: [longAlmost], expected: oracle(longAlmost) },
  ],
};
