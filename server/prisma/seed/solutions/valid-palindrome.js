function isPalindrome(s) {
  const isAlnum = (c) => /[A-Za-z0-9]/.test(c);
  let i = 0;
  let j = s.length - 1;
  while (i < j) {
    if (!isAlnum(s[i])) i++;
    else if (!isAlnum(s[j])) j--;
    else if (s[i++].toLowerCase() !== s[j--].toLowerCase()) return false;
  }
  return true;
}
