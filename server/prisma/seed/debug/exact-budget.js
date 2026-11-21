/** MEDIUM · comparing floats with ===. */
export default {
  slug: 'debug-exact-budget',
  title: 'Exact Budget',
  difficulty: 'MEDIUM',
  bugCount: 1,
  timeLimitMs: 1000,
  functionName: { javascript: 'fitsBudget', python: 'fits_budget' },
  description: `Return \`true\` when the prices add up **exactly** to the budget (amounts in dollars, with cents).

\`[0.1, 0.2]\` with a budget of \`0.3\` is rejected, although 10 + 20 cents is 30 cents.`,
  buggy: {
    javascript: `function fitsBudget(prices, budget) {
  let total = 0;
  for (const price of prices) total += price;
  return total === budget;
}
`,
    python: `def fits_budget(prices, budget):
    total = 0
    for price in prices:
        total += price
    return total == budget
`,
  },
  fixed: {
    javascript: `function fitsBudget(prices, budget) {
  let total = 0;
  for (const price of prices) total += price;
  return Math.abs(total - budget) < 1e-9;
}
`,
    python: `def fits_budget(prices, budget):
    total = 0
    for price in prices:
        total += price
    return abs(total - budget) < 1e-9
`,
  },
  tests: [
    { input: [[0.1, 0.2], 0.3], expected: true },
    { input: [[1.5, 2.5], 4], expected: true },
    { input: [[], 0], expected: true, hidden: true },
    { input: [[0.1, 0.1, 0.1], 0.3], expected: true, hidden: true },
    { input: [[1, 2], 4], expected: false, hidden: true },
    { input: [[0.7, 0.1], 0.8], expected: true, hidden: true },
    { input: [[1.1, 2.2], 3.3], expected: true, hidden: true },
    { input: [[2.25, 2.25], 4.4], expected: false, hidden: true },
  ],
};
