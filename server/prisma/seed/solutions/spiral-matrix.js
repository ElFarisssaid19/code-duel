function spiralOrder(matrix) {
  const out = [];
  let [top, bottom, left, right] = [0, matrix.length - 1, 0, matrix[0].length - 1];
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) out.push(matrix[top][c]);
    for (let r = top + 1; r <= bottom; r++) out.push(matrix[r][right]);
    if (top < bottom && left < right) {
      for (let c = right - 1; c >= left; c--) out.push(matrix[bottom][c]);
      for (let r = bottom - 1; r > top; r--) out.push(matrix[r][left]);
    }
    top++;
    bottom--;
    left++;
    right--;
  }
  return out;
}
