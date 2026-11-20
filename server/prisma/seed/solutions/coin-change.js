function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let value = 1; value <= amount; value++) {
    for (const coin of coins)
      if (coin <= value && dp[value - coin] + 1 < dp[value]) dp[value] = dp[value - coin] + 1;
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
