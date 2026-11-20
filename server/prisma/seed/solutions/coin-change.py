def coin_change(coins: list[int], amount: int) -> int:
    inf = amount + 1
    dp = [0] + [inf] * amount
    for value in range(1, amount + 1):
        for coin in coins:
            if coin <= value and dp[value - coin] + 1 < dp[value]:
                dp[value] = dp[value - coin] + 1
    return -1 if dp[amount] == inf else dp[amount]
