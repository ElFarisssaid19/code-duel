/**
 * go-judge provider (https://github.com/criyle/go-judge, docs: https://docs.goj.ac).
 * Everything go-judge-specific lives here: request format, limit units, status mapping.
 *
 * Units in the go-judge REST API: cpuLimit/clockLimit/time in nanoseconds,
 * memoryLimit/memory in bytes.
 */
import { JudgeUnavailableError } from '../errors.js';
import { LANGUAGES } from '../languages.js';
import { STATUS } from '../statuses.js';

const NS_PER_MS = 1_000_000;
const BYTES_PER_MB = 1024 * 1024;

/** stdout and stderr are each capped at 64 KB. */
export const OUTPUT_LIMIT_BYTES = 64 * 1024;
/** Max number of processes/threads (cgroup pids). Node alone uses ~7 threads. */
export const PROC_LIMIT = 32;
/** Max size of each collected file (e.g. the harness results). */
const COLLECT_FILE_MAX_BYTES = 4 * BYTES_PER_MB;
/** Extra time allowed for the HTTP round trip on top of the wall-clock limit. */
const REQUEST_TIMEOUT_EXTRA_MS = 10_000;

/** Paths inside the custom image (infra/go-judge/Dockerfile). */
const COMMANDS = {
  javascript: ({ memoryLimitMb }) => [
    '/usr/local/bin/node',
    // Keep V8's heap in line with the cgroup memory limit.
    `--max-old-space-size=${memoryLimitMb}`,
    LANGUAGES.javascript.entryFile,
  ],
  // -I: isolated mode (ignores PYTHON* env vars and user site-packages), -B: no .pyc files.
  python: () => ['/usr/bin/python3', '-I', '-B', LANGUAGES.python.entryFile],
};

const SANDBOX_ENV = ['PATH=/usr/local/bin:/usr/bin:/bin', 'HOME=/tmp', 'LANG=C.UTF-8'];

/** Wall-clock limit: generous, so processes that sleep or block are still killed. */
export const clockLimitMs = (cpuLimitMs) => cpuLimitMs * 2 + 1000;

/** Builds the go-judge `cmd` for one run. Exported for tests. */
export function buildRunCommand({
  language,
  files,
  stdin = '',
  timeLimitMs,
  memoryLimitMb,
  collectFiles = [],
}) {
  if (!COMMANDS[language]) throw new Error(`Unsupported language: ${language}`);
  return {
    args: COMMANDS[language]({ memoryLimitMb }),
    env: SANDBOX_ENV,
    files: [
      { content: stdin },
      { name: 'stdout', max: OUTPUT_LIMIT_BYTES },
      { name: 'stderr', max: OUTPUT_LIMIT_BYTES },
    ],
    cpuLimit: timeLimitMs * NS_PER_MS,
    clockLimit: clockLimitMs(timeLimitMs) * NS_PER_MS,
    memoryLimit: memoryLimitMb * BYTES_PER_MB,
    stackLimit: 64 * BYTES_PER_MB,
    procLimit: PROC_LIMIT,
    // Inline content only: nothing is cached in go-judge's file store by copyIn.
    copyIn: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, { content }])),
    // Trailing "?" = optional: a killed process may not have written the file yet.
    copyOut: collectFiles.map((name) => `${name}?`),
    copyOutMax: COLLECT_FILE_MAX_BYTES,
  };
}

/**
 * Maps a go-judge result to a judge status (+ message). The sandbox has no network
 * namespace and no host filesystem; anything blocked shows up as a runtime error.
 */
export function mapGoJudgeStatus(result) {
  const fileErrors = result.fileError ?? [];
  const stderr = result.files?.stderr ?? '';

  if (fileErrors.some((e) => e.type === 'CollectSizeExceeded')) {
    return {
      status: STATUS.RUNTIME_ERROR,
      message: `Output limit exceeded (stdout/stderr are capped at ${OUTPUT_LIMIT_BYTES / 1024} KB)`,
    };
  }
  if (fileErrors.some((e) => e.type === 'CopyOutSizeExceeded')) {
    return { status: STATUS.RUNTIME_ERROR, message: 'Output too large' };
  }

  switch (result.status) {
    case 'Accepted':
      return { status: STATUS.ACCEPTED };
    case 'Time Limit Exceeded':
      return { status: STATUS.TIME_LIMIT_EXCEEDED, message: 'Time limit exceeded' };
    case 'Memory Limit Exceeded':
      return { status: STATUS.MEMORY_LIMIT_EXCEEDED, message: 'Memory limit exceeded' };
    case 'Output Limit Exceeded':
      return { status: STATUS.RUNTIME_ERROR, message: 'Output limit exceeded' };
    case 'Nonzero Exit Status':
    case 'Signalled':
      if (/JavaScript heap out of memory|Reached heap limit/.test(stderr)) {
        return { status: STATUS.MEMORY_LIMIT_EXCEEDED, message: 'Memory limit exceeded' };
      }
      return {
        status: STATUS.RUNTIME_ERROR,
        message:
          result.status === 'Signalled'
            ? `Process killed by signal ${result.exitStatus}`
            : `Process exited with code ${result.exitStatus}`,
      };
    case 'Dangerous Syscall':
      return { status: STATUS.RUNTIME_ERROR, message: 'Blocked system call' };
    default: // 'File Error', 'Internal Error', or anything new
      return {
        status: STATUS.INTERNAL_ERROR,
        message: `go-judge: ${result.status}${result.error ? ` (${result.error})` : ''}`,
      };
  }
}

export function createGoJudgeProvider({ baseUrl, fetchImpl = fetch }) {
  const url = (path) => new URL(path, baseUrl).toString();

  async function request(path, init = {}, timeoutMs = 5000) {
    try {
      return await fetchImpl(url(path), { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new JudgeUnavailableError(`go-judge is unreachable at ${baseUrl}: ${err.message}`, {
        cause: err,
      });
    }
  }

  /** Deletes files cached in go-judge's file store (only exists if a run cached outputs). */
  async function deleteCachedFiles(fileIds = {}) {
    await Promise.allSettled(
      Object.values(fileIds).map((id) =>
        request(`/file/${encodeURIComponent(id)}`, { method: 'DELETE' }),
      ),
    );
  }

  return {
    name: 'gojudge',

    /**
     * runCode({ language, files, stdin, timeLimitMs, memoryLimitMb, collectFiles })
     *   → { status, message, stdout, stderr, timeMs, memoryKb, exitCode, files }
     * timeLimitMs is the CPU budget of the whole run.
     */
    async runCode({ memoryLimitMb = 256, ...options }) {
      const cmd = buildRunCommand({ ...options, memoryLimitMb });
      const res = await request(
        '/run',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cmd: [cmd] }),
        },
        clockLimitMs(options.timeLimitMs) + REQUEST_TIMEOUT_EXTRA_MS,
      );
      if (!res.ok) {
        throw new JudgeUnavailableError(`go-judge responded ${res.status}: ${await res.text()}`);
      }

      const [result] = await res.json();
      try {
        const { status, message } = mapGoJudgeStatus(result);
        const files = result.files ?? {};
        return {
          status,
          message: message ?? null,
          stdout: files.stdout ?? '',
          stderr: files.stderr ?? '',
          timeMs: Math.round((result.time ?? 0) / NS_PER_MS),
          memoryKb: Math.round((result.memory ?? 0) / 1024),
          exitCode: result.exitStatus ?? null,
          files: Object.fromEntries(
            (options.collectFiles ?? []).map((name) => [name, files[name] ?? null]),
          ),
        };
      } finally {
        await deleteCachedFiles(result.fileIds);
      }
    },

    /** true if go-judge answers GET /version. */
    async health() {
      try {
        const res = await request('/version', {}, 2000);
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
