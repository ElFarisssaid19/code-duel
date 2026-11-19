import averageSalary from './average-salary.js';
import fizzBuzz from './fizz-buzz.js';
import longestSubstring from './longest-substring.js';
import mergeIntervals from './merge-intervals.js';
import productExceptSelf from './product-except-self.js';
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
];
