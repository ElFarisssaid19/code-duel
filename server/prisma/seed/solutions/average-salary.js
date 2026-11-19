function averageSalary(salary) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const s of salary) {
    min = Math.min(min, s);
    max = Math.max(max, s);
    sum += s;
  }
  return (sum - min - max) / (salary.length - 2);
}
