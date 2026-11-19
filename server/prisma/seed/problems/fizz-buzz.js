const oracle = (n) =>
  Array.from({ length: n }, (_, k) => {
    const i = k + 1;
    return (i % 3 === 0 ? 'Fizz' : '') + (i % 5 === 0 ? 'Buzz' : '') || String(i);
  });

export default {
  slug: 'fizz-buzz',
  title: 'Fizz Buzz',
  difficulty: 'EASY',
  timeLimitMs: 2000,
  functionName: { javascript: 'fizzBuzz', python: 'fizz_buzz' },
  starterCode: {
    javascript: `/**
 * @param {number} n
 * @return {string[]}
 */
function fizzBuzz(n) {
  
}
`,
    python: `def fizz_buzz(n: int) -> list[str]:
    pass
`,
  },
  description: `Given an integer \`n\`, return a list of strings \`answer\` (1-indexed) where:

- \`answer[i] == "FizzBuzz"\` if \`i\` is divisible by both 3 and 5
- \`answer[i] == "Fizz"\` if \`i\` is divisible by 3
- \`answer[i] == "Buzz"\` if \`i\` is divisible by 5
- \`answer[i] == i\` (as a string) otherwise

### Example 1

\`\`\`
Input:  n = 3
Output: ["1", "2", "Fizz"]
\`\`\`

### Example 2

\`\`\`
Input:  n = 5
Output: ["1", "2", "Fizz", "4", "Buzz"]
\`\`\`

### Constraints

- \`1 <= n <= 10^4\`
`,
  tests: [
    { input: [3], expected: ['1', '2', 'Fizz'] },
    { input: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] },
    { hidden: true, input: [1], expected: ['1'] },
    {
      hidden: true,
      input: [15],
      expected: [
        '1',
        '2',
        'Fizz',
        '4',
        'Buzz',
        'Fizz',
        '7',
        '8',
        'Fizz',
        'Buzz',
        '11',
        'Fizz',
        '13',
        '14',
        'FizzBuzz',
      ],
    },
    { hidden: true, input: [16], expected: oracle(16) },
    { hidden: true, input: [30], expected: oracle(30) },
    { hidden: true, input: [100], expected: oracle(100) },
    { hidden: true, input: [10_000], expected: oracle(10_000) },
  ],
};
