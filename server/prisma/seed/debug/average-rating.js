/** EASY · integer division instead of float division. */
export default {
  slug: 'debug-average-rating',
  title: 'Average Rating',
  difficulty: 'EASY',
  bugCount: 1,
  timeLimitMs: 1000,
  functionName: { javascript: 'averageRating', python: 'average_rating' },
  description: `Return the **average** of the ratings, rounded to **2 decimals**. An empty list averages to \`0\`.

Products rated 4 and 5 show an average of 4. Find the bug.`,
  buggy: {
    javascript: `function averageRating(ratings) {
  if (ratings.length === 0) return 0;
  let total = 0;
  for (const rating of ratings) total += rating;
  const average = Math.floor(total / ratings.length);
  return Math.round(average * 100) / 100;
}
`,
    python: `def average_rating(ratings):
    if not ratings:
        return 0
    total = sum(ratings)
    average = total // len(ratings)
    return round(average, 2)
`,
  },
  fixed: {
    javascript: `function averageRating(ratings) {
  if (ratings.length === 0) return 0;
  let total = 0;
  for (const rating of ratings) total += rating;
  const average = total / ratings.length;
  return Math.round(average * 100) / 100;
}
`,
    python: `def average_rating(ratings):
    if not ratings:
        return 0
    total = sum(ratings)
    average = total / len(ratings)
    return round(average, 2)
`,
  },
  tests: [
    { input: [[4, 5]], expected: 4.5 },
    { input: [[3, 3, 3]], expected: 3 },
    { input: [[]], expected: 0, hidden: true },
    { input: [[5]], expected: 5, hidden: true },
    { input: [[1, 2]], expected: 1.5, hidden: true },
    { input: [[4, 4, 5]], expected: 4.33, hidden: true },
    { input: [[2, 3, 3]], expected: 2.67, hidden: true },
    { input: [[1, 1, 1, 2]], expected: 1.25, hidden: true },
  ],
};
