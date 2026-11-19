import { createRandom } from '../random.js';

const oracle = (salary) => {
  const sorted = [...salary].sort((a, b) => a - b).slice(1, -1);
  return sorted.reduce((sum, x) => sum + x, 0) / sorted.length;
};

function largeCase() {
  const rand = createRandom(5);
  const values = new Set();
  while (values.size < 100) values.add(rand.int(1000, 1_000_000));
  return [...values];
}

const twenty = [
  48000, 59000, 99000, 13000, 78000, 45000, 31000, 17000, 39000, 37000, 93000, 77000, 33000, 28000,
  4000, 54000, 67000, 6000, 1000, 11000,
];
const large = largeCase();

export default {
  slug: 'average-salary',
  title: 'Average Salary Without Extremes',
  difficulty: 'EASY',
  timeLimitMs: 2000,
  functionName: { javascript: 'averageSalary', python: 'average_salary' },
  starterCode: {
    javascript: `/**
 * @param {number[]} salary
 * @return {number}
 */
function averageSalary(salary) {
  
}
`,
    python: `def average_salary(salary: list[int]) -> float:
    pass
`,
  },
  description: `You are given an array of **unique** integers \`salary\`, where \`salary[i]\` is the salary of employee \`i\`.

Return the **average salary** of all employees, excluding the minimum and the maximum salary.

Answers within \`10^-6\` of the exact value are accepted.

### Example 1

\`\`\`
Input:  salary = [4000, 3000, 1000, 2000]
Output: 2500.0
\`\`\`

Excluding 1000 (minimum) and 4000 (maximum), the average is (2000 + 3000) / 2 = 2500.

### Example 2

\`\`\`
Input:  salary = [1000, 2000, 3000]
Output: 2000.0
\`\`\`

### Constraints

- \`3 <= salary.length <= 100\`
- \`1000 <= salary[i] <= 10^6\`
- All values in \`salary\` are unique.
`,
  tests: [
    { input: [[4000, 3000, 1000, 2000]], expected: 2500 },
    { input: [[1000, 2000, 3000]], expected: 2000 },
    { hidden: true, input: [[6000, 5000, 4000, 3000, 2000, 1000]], expected: 3500 },
    { hidden: true, input: [[8000, 9000, 2000, 3000, 6000, 1000]], expected: 4750 },
    { hidden: true, input: [[1000, 2000, 3001]], expected: 2000 },
    { hidden: true, input: [[3000, 1000, 2000, 7000]], expected: 2500 },
    { hidden: true, input: [[1000, 1001, 1002, 1010, 2000]], expected: 3013 / 3 },
    { hidden: true, input: [[1000, 1001, 1003, 1004]], expected: 1002 },
    { hidden: true, input: [twenty], expected: oracle(twenty) },
    { hidden: true, input: [large], expected: oracle(large) },
  ],
};
