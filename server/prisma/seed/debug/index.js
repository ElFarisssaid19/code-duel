import averageRating from './average-rating.js';
import exactBudget from './exact-budget.js';
import lastK from './last-k.js';
import longestStreak from './longest-streak.js';
import nestedSum from './nested-sum.js';
import outOfPlace from './out-of-place.js';
import pairCount from './pair-count.js';
import passingGrades from './passing-grades.js';
import topThree from './top-three.js';
import uniqueWords from './unique-words.js';

/**
 * DEBUG problems: { slug, title, difficulty, bugCount (1-3), timeLimitMs, functionName,
 * description (expected behavior), buggy: { javascript, python }, fixed: { javascript, python },
 * tests: [{ input, expected, hidden? }] } with the samples first. The editor starts with
 * `buggy`; `fixed` is the reference. Same judge and harness as ALGO problems.
 */
export default [
  lastK,
  passingGrades,
  averageRating,
  uniqueWords,
  outOfPlace,
  topThree,
  pairCount,
  exactBudget,
  longestStreak,
  nestedSum,
];
