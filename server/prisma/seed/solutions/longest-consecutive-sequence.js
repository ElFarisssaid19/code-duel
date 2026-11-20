function longestConsecutive(nums) {
  const set = new Set(nums);
  let best = 0;
  for (const x of set) {
    if (set.has(x - 1)) continue; // only start counting at the beginning of a run
    let length = 1;
    while (set.has(x + length)) length++;
    best = Math.max(best, length);
  }
  return best;
}
