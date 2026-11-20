function lengthOfLIS(nums) {
  const tails = []; // tails[k] = smallest tail of an increasing subsequence of length k + 1
  for (const x of nums) {
    let [lo, hi] = [0, tails.length];
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
}
