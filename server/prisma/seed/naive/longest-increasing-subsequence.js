// Naive O(n²) dynamic programming: must hit the time limit on the large hidden tests.
function lengthOfLIS(nums) {
  const dp = nums.map(() => 1);
  let best = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < i; j++) if (nums[j] < nums[i] && dp[j] + 1 > dp[i]) dp[i] = dp[j] + 1;
    best = Math.max(best, dp[i]);
  }
  return best;
}
