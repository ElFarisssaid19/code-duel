def count_inversions(nums: list[int]) -> int:
    a = list(nums)
    n = len(a)
    count = 0
    width = 1
    while width < n:
        merged = []
        for lo in range(0, n, 2 * width):
            mid = min(lo + width, n)
            hi = min(lo + 2 * width, n)
            i, j = lo, mid
            while i < mid and j < hi:
                if a[i] <= a[j]:
                    merged.append(a[i])
                    i += 1
                else:
                    count += mid - i
                    merged.append(a[j])
                    j += 1
            merged.extend(a[i:mid])
            merged.extend(a[j:hi])
        a = merged
        width *= 2
    return count
