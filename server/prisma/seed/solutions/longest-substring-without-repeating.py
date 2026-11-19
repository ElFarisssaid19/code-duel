def length_of_longest_substring(s: str) -> int:
    last_seen = {}
    start = best = 0
    for i, c in enumerate(s):
        if last_seen.get(c, -1) >= start:
            start = last_seen[c] + 1
        last_seen[c] = i
        best = max(best, i - start + 1)
    return best
