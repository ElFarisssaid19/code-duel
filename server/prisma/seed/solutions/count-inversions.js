function countInversions(nums) {
  // Bottom-up merge sort, counting pairs that cross each merge.
  let a = nums.slice();
  let b = new Array(a.length);
  let count = 0;
  for (let width = 1; width < a.length; width *= 2) {
    for (let lo = 0; lo < a.length; lo += 2 * width) {
      const mid = Math.min(lo + width, a.length);
      const hi = Math.min(lo + 2 * width, a.length);
      let [i, j, k] = [lo, mid, lo];
      while (i < mid && j < hi) {
        if (a[i] <= a[j]) b[k++] = a[i++];
        else {
          count += mid - i; // a[i..mid) are all greater than a[j]
          b[k++] = a[j++];
        }
      }
      while (i < mid) b[k++] = a[i++];
      while (j < hi) b[k++] = a[j++];
    }
    [a, b] = [b, a];
  }
  return count;
}
