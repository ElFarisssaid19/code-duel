function trap(height) {
  let [left, right] = [0, height.length - 1];
  let [leftMax, rightMax, water] = [0, 0, 0];
  while (left < right) {
    if (height[left] < height[right]) {
      leftMax = Math.max(leftMax, height[left]);
      water += leftMax - height[left++];
    } else {
      rightMax = Math.max(rightMax, height[right]);
      water += rightMax - height[right--];
    }
  }
  return water;
}
