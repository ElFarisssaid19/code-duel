/**
 * Integration tests against the REAL go-judge container (npm run infra:up).
 */
import { userInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { judgeSolution, runCode } from '../../src/services/judge/index.js';

const tests = [
  { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
  { input: [[3, 2, 4], 6], expected: [1, 2] },
  { input: [[3, 3], 6], expected: [0, 1] },
];

// Per language: the function name and one program for each scenario.
const LANGUAGES = {
  javascript: {
    functionName: 'twoSum',
    correct: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
}`,
    wrong: 'function twoSum(nums, target) { console.log("checking", target); return [0, 0]; }',
    syntaxError: 'function twoSum(nums, target) {\n  return [0, 1\n}',
    // Throws on the second test only: the others must still run.
    throws: `function twoSum(nums, target) {
  if (target === 6 && nums.length === 3) throw new Error("boom");
  return target === 9 ? [0, 1] : [0, 1];
}`,
    infiniteLoop: `function twoSum(nums, target) {
  if (nums.length === 4) while (true) {}
  return nums.length === 3 ? [1, 2] : [0, 1];
}`,
    hugeAllocation: `function twoSum() {
  const chunks = [];
  for (;;) chunks.push(new Array(1e6).fill(Math.random()));
}`,
    networkProgram: `fetch("http://1.1.1.1", { signal: AbortSignal.timeout(3000) })
  .then(() => console.log("NETWORK OK"))
  .catch((e) => console.log("NETWORK FAILED", e.cause?.code ?? e.message));`,
    readFileProgram: (path) =>
      `try { console.log(require("fs").readFileSync(${JSON.stringify(path)}, "utf8")); } catch (e) { console.log("READ FAILED", e.code); }`,
  },
  python: {
    functionName: 'two_sum',
    correct: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
`,
    wrong: 'def two_sum(nums, target):\n    print("checking", target)\n    return [0, 0]\n',
    syntaxError: 'def two_sum(nums, target)\n    return [0, 1]\n',
    throws: `def two_sum(nums, target):
    if target == 6 and len(nums) == 3:
        raise ValueError("boom")
    return [0, 1]
`,
    infiniteLoop: `def two_sum(nums, target):
    if len(nums) == 4:
        while True:
            pass
    return [1, 2] if len(nums) == 3 else [0, 1]
`,
    hugeAllocation: `def two_sum(nums, target):
    chunks = []
    while True:
        chunks.append(bytearray(10 * 1024 * 1024))
`,
    networkProgram: `import socket
try:
    socket.create_connection(("1.1.1.1", 80), timeout=3)
    print("NETWORK OK")
except OSError as e:
    print("NETWORK FAILED", e)
`,
    readFileProgram: (path) => `try:
    print(open(${JSON.stringify(path)}).read())
except OSError as e:
    print("READ FAILED", e)
`,
  },
};

const entryFile = { javascript: 'main.js', python: 'main.py' };

describe.each(Object.keys(LANGUAGES))('go-judge integration: %s', (language) => {
  const lang = LANGUAGES[language];
  const judge = (code, overrides = {}) =>
    judgeSolution({
      language,
      code,
      functionName: lang.functionName,
      tests,
      timeLimitMs: 1000,
      ...overrides,
    });
  const runProgram = (code) =>
    runCode({ language, files: { [entryFile[language]]: code }, timeLimitMs: 5000 });

  it('correct solution → ACCEPTED', async () => {
    const verdict = await judge(lang.correct);
    expect(verdict).toMatchObject({ status: 'ACCEPTED', passed: 3, total: 3 });
    expect(verdict.tests.every((t) => typeof t.timeMs === 'number')).toBe(true);
  });

  it('wrong solution → WRONG_ANSWER with actual vs expected and captured logs', async () => {
    const verdict = await judge(lang.wrong);
    expect(verdict.status).toBe('WRONG_ANSWER');
    expect(verdict.tests[1]).toMatchObject({
      status: 'WRONG_ANSWER',
      expected: [1, 2],
      actual: [0, 0],
    });
    expect(verdict.tests[1].logs).toContain('checking 6');
  });

  it('syntax error → COMPILE_ERROR', async () => {
    const verdict = await judge(lang.syntaxError);
    expect(verdict.status).toBe('COMPILE_ERROR');
    expect(verdict.compileError).toMatch(/SyntaxError/);
  });

  it('thrown error → RUNTIME_ERROR, and the other tests still run', async () => {
    const verdict = await judge(lang.throws);
    expect(verdict.status).toBe('RUNTIME_ERROR');
    expect(verdict.tests.map((t) => t.status)).toEqual(['ACCEPTED', 'RUNTIME_ERROR', 'ACCEPTED']);
    expect(verdict.tests[1].error).toMatch(/boom/);
  });

  it('infinite loop → TIME_LIMIT_EXCEEDED, and the other tests still run', async () => {
    const verdict = await judge(lang.infiniteLoop, { timeLimitMs: 500 });
    expect(verdict.status).toBe('TIME_LIMIT_EXCEEDED');
    expect(verdict.tests.map((t) => t.status)).toEqual([
      'TIME_LIMIT_EXCEEDED',
      'ACCEPTED',
      'ACCEPTED',
    ]);
  });

  it('huge allocation → MEMORY_LIMIT_EXCEEDED', async () => {
    const verdict = await judge(lang.hugeAllocation);
    expect(verdict.status).toBe('MEMORY_LIMIT_EXCEEDED');
    expect(verdict.tests[0].status).toBe('MEMORY_LIMIT_EXCEEDED');
  });

  it('network requests from user code fail', async () => {
    const result = await runProgram(lang.networkProgram);
    expect(result.status).toBe('ACCEPTED');
    expect(result.stdout).toMatch(/NETWORK FAILED/);
    expect(result.stdout).not.toMatch(/NETWORK OK/);
  });

  it("cannot read the host's /etc/passwd (or any host file)", async () => {
    const passwd = await runProgram(lang.readFileProgram('/etc/passwd'));
    // The sandbox only sees the fixed passwd file from infra/go-judge/passwd.
    expect(passwd.stdout).toContain('go-judge:x:1536:1536');
    expect(passwd.stdout.trim().split('\n')).toHaveLength(3);
    expect(passwd.stdout).not.toContain(`${userInfo().username}:`);

    const home = await runProgram(lang.readFileProgram(`/home/${userInfo().username}/.bashrc`));
    expect(home.stdout).toMatch(/READ FAILED/);
  });
});

describe('go-judge file store', () => {
  it('has no cached files left after runs', async () => {
    const res = await fetch(new URL('/file', env.JUDGE_URL));
    expect(await res.json()).toEqual({});
  });
});
