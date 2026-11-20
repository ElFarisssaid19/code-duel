function largestRectangleArea(heights) {
  const stack = []; // indices of bars with increasing heights
  let best = 0;
  for (let i = 0; i <= heights.length; i++) {
    const h = i === heights.length ? 0 : heights[i];
    while (stack.length && heights[stack.at(-1)] >= h) {
      const height = heights[stack.pop()];
      const left = stack.length ? stack.at(-1) + 1 : 0;
      best = Math.max(best, height * (i - left));
    }
    stack.push(i);
  }
  return best;
}
