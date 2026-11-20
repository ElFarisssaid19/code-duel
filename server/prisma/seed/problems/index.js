import averageSalary from './average-salary.js';
import coinChange from './coin-change.js';
import countInversions from './count-inversions.js';
import fizzBuzz from './fizz-buzz.js';
import largestRectangle from './largest-rectangle.js';
import longestConsecutive from './longest-consecutive.js';
import longestIncreasingSubsequence from './longest-increasing-subsequence.js';
import longestSubstring from './longest-substring.js';
import mergeIntervals from './merge-intervals.js';
import productExceptSelf from './product-except-self.js';
import spiralMatrix from './spiral-matrix.js';
import subarraySum from './subarray-sum.js';
import trappingRainWater from './trapping-rain-water.js';
import twoSum from './two-sum.js';
import validPalindrome from './valid-palindrome.js';
import validParentheses from './valid-parentheses.js';

/**
 * Seeded problems. Each one: { slug, title, difficulty, timeLimitMs, functionName, starterCode,
 * description (markdown), tests: [{ input: [...args], expected, hidden? }] } with the sample
 * tests (hidden: false) first. Reference solutions live in ../solutions/<slug>.{js,py}.
 */
export default [
  twoSum,
  validPalindrome,
  fizzBuzz,
  validParentheses,
  averageSalary,
  longestSubstring,
  productExceptSelf,
  mergeIntervals,
  longestConsecutive,
  subarraySum,
  spiralMatrix,
  coinChange,
  countInversions,
  largestRectangle,
  longestIncreasingSubsequence,
  trappingRainWater,
];

/** Naive O(n²) solutions (../naive/<slug>.js) that must time out on each HARD problem. */
export const HARD_SLUGS = [
  countInversions.slug,
  largestRectangle.slug,
  longestIncreasingSubsequence.slug,
  trappingRainWater.slug,
];
