'use strict';
/*
 * Code Duel test harness for JavaScript. Runs INSIDE the sandbox as /w/main.js; the user's
 * code is /w/solution.js. Never runs on the server.
 *
 * stdin (JSON): { functionName, timeLimitMs, maxLogBytes, resultsFile, tests: [[...args], ...] }
 * Writes one JSON record per line to resultsFile:
 *   { type: 'compile_error', message }
 *   { type: 'setup', error, logs }
 *   { type: 'test', index, status: 'ok'|'error'|'timeout'|'memory', actual?, error?, logs, timeMs }
 *   { type: 'done' }
 *
 * User code runs in a separate vm context (no require/process), each test with its own
 * timeout, so one test throwing or looping forever doesn't stop the others.
 *
 * TODO(security): results can be spoofed. `vm` is not a security boundary: user code can
 * escape the context (e.g. via a host function's constructor), reach `process`/`fs`, and
 * append fake "ok" records to the results file or read the inputs of other tests. The
 * sandbox still contains it (no network, no host files, limits enforced), but verdicts
 * could be forged. Harden later, e.g. by running each test in its own sandbox process or by
 * signing records with a key the user code can't reach.
 */
const fs = require('node:fs');
const util = require('node:util');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

// Read all of stdin before any user code runs.
const { functionName, timeLimitMs, maxLogBytes, resultsFile, tests } = JSON.parse(
  fs.readFileSync(0, 'utf8'),
);

function emit(record) {
  fs.appendFileSync(resultsFile, `${JSON.stringify(record)}\n`);
}

// Captures console output, capped at maxLogBytes per test.
let logs = '';
let logsFull = false;
function writeLog(...args) {
  if (logsFull || maxLogBytes <= 0) return;
  const line = `${args
    .map((arg) => (typeof arg === 'string' ? arg : util.inspect(arg, { depth: 4 })))
    .join(' ')}\n`;
  if (Buffer.byteLength(logs) + Buffer.byteLength(line) > maxLogBytes) {
    logs = `${Buffer.from(logs + line)
      .subarray(0, maxLogBytes)
      .toString()}\n… (output truncated)`;
    logsFull = true;
  } else {
    logs += line;
  }
}
function takeLogs() {
  const text = logs;
  logs = '';
  logsFull = false;
  return text;
}

const isTimeout = (err) => err && err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
// Errors thrown in the vm context aren't instances of this realm's Error: check by name.
const isOutOfMemory = (err) =>
  Boolean(err) && err.name === 'RangeError' && /allocation failed|out of memory/i.test(err.message);

/** "Error: message" plus the stack frames that point into the user's file. */
function describeError(err) {
  if (err && typeof err.name === 'string' && typeof err.message === 'string') {
    // err.stack may start with a "solution.js:3 / code / ^" header that Node adds: skip it
    // and keep only the "at ..." frames that point into the user's file.
    const frames = String(err.stack || '')
      .split('\n')
      .filter((line) => /^\s+at .*solution\.js/.test(line));
    return [`${err.name}: ${err.message}`, ...frames].join('\n');
  }
  return `Uncaught ${util.inspect(err)}`;
}

/** V8 syntax errors: "solution.js:3", the code line, a caret line, then "SyntaxError: ...". */
function describeSyntaxError(err) {
  const lines = String(err.stack || err).split('\n');
  const end = lines.findIndex((line) => line.startsWith('SyntaxError'));
  return (end === -1 ? lines : lines.slice(0, end + 1)).join('\n').trim();
}

function main() {
  const source = fs.readFileSync('solution.js', 'utf8');

  let script;
  try {
    script = new vm.Script(source, { filename: 'solution.js' });
  } catch (err) {
    emit({ type: 'compile_error', message: describeSyntaxError(err) });
    return;
  }

  const consoleMethods = ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table'];
  const context = vm.createContext({
    console: Object.fromEntries(consoleMethods.map((method) => [method, writeLog])),
    structuredClone,
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
  });

  let setupError = null;
  try {
    script.runInContext(context, { timeout: timeLimitMs });
    if (vm.runInContext(`typeof ${functionName}`, context) !== 'function') {
      setupError = `${functionName} is not defined. Your code must define a function named "${functionName}".`;
    }
  } catch (err) {
    setupError = isTimeout(err)
      ? 'Time limit exceeded while loading your code'
      : describeError(err);
  }
  emit({ type: 'setup', error: setupError, logs: takeLogs() });
  if (setupError) return;

  // Inputs are parsed and results serialized inside the user's context, so values belong
  // to that realm (Array.isArray / instanceof behave as expected for user code).
  const call = new vm.Script(
    `JSON.stringify((function (r) { return r === undefined ? null : r; })(${functionName}(...JSON.parse(__codeDuelInput))))`,
    { filename: 'harness.js' },
  );

  tests.forEach((args, index) => {
    context.__codeDuelInput = JSON.stringify(args);
    const record = { type: 'test', index };
    const start = performance.now();
    try {
      const json = call.runInContext(context, { timeout: timeLimitMs });
      if (json === undefined) {
        record.status = 'error';
        record.error = 'Return value is not JSON-serializable';
      } else {
        record.status = 'ok';
        record.actual = JSON.parse(json);
      }
    } catch (err) {
      if (isTimeout(err)) {
        record.status = 'timeout';
      } else if (isOutOfMemory(err)) {
        record.status = 'memory';
      } else {
        record.status = 'error';
        record.error = describeError(err);
      }
    }
    record.timeMs = Math.round((performance.now() - start) * 100) / 100;
    record.logs = takeLogs();
    emit(record);
  });
}

main();
emit({ type: 'done' });
