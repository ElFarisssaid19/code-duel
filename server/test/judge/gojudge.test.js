import { describe, expect, it, vi } from 'vitest';
import { JudgeUnavailableError } from '../../src/services/judge/errors.js';
import {
  buildRunCommand,
  createGoJudgeProvider,
  mapGoJudgeStatus,
} from '../../src/services/judge/providers/gojudge.js';

describe('mapGoJudgeStatus', () => {
  it.each([
    [{ status: 'Accepted', exitStatus: 0 }, 'ACCEPTED'],
    [{ status: 'Time Limit Exceeded', exitStatus: 9 }, 'TIME_LIMIT_EXCEEDED'],
    [{ status: 'Memory Limit Exceeded', exitStatus: 9 }, 'MEMORY_LIMIT_EXCEEDED'],
    [{ status: 'Nonzero Exit Status', exitStatus: 1 }, 'RUNTIME_ERROR'],
    [{ status: 'Signalled', exitStatus: 11 }, 'RUNTIME_ERROR'],
    [{ status: 'Output Limit Exceeded' }, 'RUNTIME_ERROR'],
    [{ status: 'Dangerous Syscall' }, 'RUNTIME_ERROR'],
    [{ status: 'Internal Error', error: 'container create failed' }, 'INTERNAL_ERROR'],
    [{ status: 'File Error' }, 'INTERNAL_ERROR'],
    [{ status: 'Something New' }, 'INTERNAL_ERROR'],
  ])('maps %o → %s', (result, expected) => {
    expect(mapGoJudgeStatus(result).status).toBe(expected);
  });

  it('treats a V8 heap out-of-memory crash as MEMORY_LIMIT_EXCEEDED', () => {
    const result = {
      status: 'Signalled',
      exitStatus: 6,
      files: {
        stderr: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory',
      },
    };
    expect(mapGoJudgeStatus(result).status).toBe('MEMORY_LIMIT_EXCEEDED');
  });

  it('reports the 64 KB stdout/stderr cap as a runtime error', () => {
    const result = {
      status: 'Nonzero Exit Status',
      exitStatus: 120,
      fileError: [
        { name: 'stdout', type: 'CollectSizeExceeded', message: 'Output Limit Exceeded' },
      ],
    };
    expect(mapGoJudgeStatus(result)).toEqual({
      status: 'RUNTIME_ERROR',
      message: 'Output limit exceeded (stdout/stderr are capped at 64 KB)',
    });
  });
});

describe('buildRunCommand', () => {
  it('uses go-judge units: nanoseconds and bytes', () => {
    const cmd = buildRunCommand({
      language: 'python',
      files: { 'main.py': 'print(1)' },
      stdin: '{"tests":[]}',
      timeLimitMs: 1500,
      memoryLimitMb: 256,
      collectFiles: ['results.jsonl'],
    });

    expect(cmd.args).toEqual(['/usr/bin/python3', '-I', '-B', 'main.py']);
    expect(cmd.cpuLimit).toBe(1_500_000_000);
    expect(cmd.clockLimit).toBe(4_000_000_000);
    expect(cmd.memoryLimit).toBe(256 * 1024 * 1024);
    expect(cmd.procLimit).toBe(32);
    expect(cmd.files).toEqual([
      { content: '{"tests":[]}' },
      { name: 'stdout', max: 65536 },
      { name: 'stderr', max: 65536 },
    ]);
    expect(cmd.copyIn).toEqual({ 'main.py': { content: 'print(1)' } });
    expect(cmd.copyOut).toEqual(['results.jsonl?']);
    expect(cmd.copyOutCached).toBeUndefined();
  });

  it('caps the V8 heap at the memory limit for JavaScript', () => {
    const cmd = buildRunCommand({
      language: 'javascript',
      files: {},
      timeLimitMs: 1000,
      memoryLimitMb: 128,
    });
    expect(cmd.args).toEqual(['/usr/local/bin/node', '--max-old-space-size=128', 'main.js']);
  });
});

describe('createGoJudgeProvider (fetch mocked)', () => {
  const okResponse = (body) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => '',
  });

  it('posts to /run, maps the result, and deletes any cached files afterwards', async () => {
    const fetchImpl = vi.fn(async (url) =>
      url.endsWith('/run')
        ? okResponse([
            {
              status: 'Accepted',
              exitStatus: 0,
              time: 31_000_000,
              memory: 10 * 1024 * 1024,
              files: { stdout: 'hi\n', stderr: '', 'results.jsonl': '{"type":"done"}\n' },
              fileIds: { 'cached.bin': 'ABC123' },
            },
          ])
        : okResponse({}),
    );
    const judge = createGoJudgeProvider({ baseUrl: 'http://judge.test:5050', fetchImpl });

    const result = await judge.runCode({
      language: 'javascript',
      files: { 'main.js': 'x' },
      timeLimitMs: 1000,
      collectFiles: ['results.jsonl'],
    });

    expect(result).toEqual({
      status: 'ACCEPTED',
      message: null,
      stdout: 'hi\n',
      stderr: '',
      timeMs: 31,
      memoryKb: 10240,
      exitCode: 0,
      files: { 'results.jsonl': '{"type":"done"}\n' },
    });
    const [runUrl, runInit] = fetchImpl.mock.calls[0];
    expect(runUrl).toBe('http://judge.test:5050/run');
    expect(JSON.parse(runInit.body).cmd[0].memoryLimit).toBe(256 * 1024 * 1024);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://judge.test:5050/file/ABC123',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws JudgeUnavailableError when go-judge is unreachable or errors', async () => {
    const down = createGoJudgeProvider({
      baseUrl: 'http://judge.test:5050',
      fetchImpl: vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    });
    await expect(
      down.runCode({ language: 'python', files: {}, timeLimitMs: 1000 }),
    ).rejects.toBeInstanceOf(JudgeUnavailableError);
    expect(await down.health()).toBe(false);

    const broken = createGoJudgeProvider({
      baseUrl: 'http://judge.test:5050',
      fetchImpl: vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' })),
    });
    await expect(
      broken.runCode({ language: 'python', files: {}, timeLimitMs: 1000 }),
    ).rejects.toThrow(/responded 500/);
  });
});
