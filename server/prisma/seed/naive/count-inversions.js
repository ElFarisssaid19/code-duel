// Naive O(n²): must hit the time limit on the large hidden tests.
function countInversions(nums) {
  let count = 0;
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++) if (nums[i] > nums[j]) count++;
  return count;
}
