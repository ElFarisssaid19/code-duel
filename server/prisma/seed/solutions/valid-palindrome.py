def is_palindrome(s: str) -> bool:
    cleaned = [c.lower() for c in s if c.isascii() and c.isalnum()]
    return cleaned == cleaned[::-1]
