// Independent oracle: repeatedly delete adjacent matching pairs.
function oracle(s) {
  let prev;
  let current = s;
  do {
    prev = current;
    current = current.replaceAll('()', '').replaceAll('[]', '').replaceAll('{}', '');
  } while (current !== prev);
  return current.length === 0;
}

const deep = `${'([{'.repeat(1600)}${'}])'.repeat(1600)}`;
const deepBroken = `${'([{'.repeat(1600)}${'}])'.repeat(1599)}})`;
const flat = `${'()[]{}'.repeat(1500)}(`;

export default {
  slug: 'valid-parentheses',
  title: 'Valid Parentheses',
  difficulty: 'EASY',
  timeLimitMs: 2000,
  functionName: { javascript: 'isValid', python: 'is_valid' },
  starterCode: {
    javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
  
}
`,
    python: `def is_valid(s: str) -> bool:
    pass
`,
  },
  description: `Given a string \`s\` containing only the characters \`(\`, \`)\`, \`[\`, \`]\`, \`{\` and \`}\`, determine whether it is **valid**.

A string is valid when:

1. Every opening bracket is closed by a bracket of the same type.
2. Brackets are closed in the correct order.
3. Every closing bracket has a matching opening bracket.

### Example 1

\`\`\`
Input:  s = "()[]{}"
Output: true
\`\`\`

### Example 2

\`\`\`
Input:  s = "(]"
Output: false
\`\`\`

### Constraints

- \`1 <= s.length <= 10^4\`
- \`s\` consists only of \`()[]{}\`.
`,
  tests: [
    { input: ['()[]{}'], expected: true },
    { input: ['(]'], expected: false },
    { hidden: true, input: ['([{}])'], expected: true },
    { hidden: true, input: ['('], expected: false },
    { hidden: true, input: [')'], expected: false },
    { hidden: true, input: ['([)]'], expected: false },
    { hidden: true, input: ['{[]}'], expected: true },
    { hidden: true, input: ['(((((((())))))))'], expected: true },
    { hidden: true, input: ['(()'], expected: false },
    { hidden: true, input: [deep], expected: oracle(deep) },
    { hidden: true, input: [deepBroken], expected: oracle(deepBroken) },
    { hidden: true, input: [flat], expected: oracle(flat) },
  ],
};
