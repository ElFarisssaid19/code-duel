// Naive O(n²): must hit the time limit on the large hidden tests.
function largestRectangleArea(heights) {
  let best = 0;
  for (let i = 0; i < heights.length; i++) {
    let min = Infinity;
    for (let j = i; j < heights.length; j++) {
      min = Math.min(min, heights[j]);
      best = Math.max(best, min * (j - i + 1));
    }
  }
  return best;
}
