"""Code Duel test harness for Python.

Runs INSIDE the sandbox as /w/main.py; the user's code is /w/solution.py. Never runs on the server.

stdin (JSON): {functionName, timeLimitMs, maxLogBytes, resultsFile, tests: [[...args], ...]}
Writes one JSON record per line to resultsFile:
  {"type": "compile_error", "message"}
  {"type": "setup", "error", "logs"}
  {"type": "test", "index", "status": "ok"|"error"|"timeout"|"memory", "actual"?, "error"?, "logs", "timeMs"}
  {"type": "done"}

Each test runs with its own time limit (SIGALRM), so one test raising or looping forever
doesn't stop the others.

TODO(security): results can be spoofed. User code runs in this same interpreter, so it can
write fake "ok" records to the results file (or sys.__stdout__), or inspect the harness's
memory (e.g. gc / frames) to read other tests' inputs. The sandbox still contains it (no
network, no host files, limits enforced), but verdicts could be forged. Harden later, e.g. by
running each test in its own sandbox process or by signing records with a key the user code
can't reach.
"""

import contextlib
import io
import json
import signal
import sys
import time
import traceback


class LogBuffer(io.TextIOBase):
    """Captures print() output, capped at max_bytes per test."""

    def __init__(self, max_bytes):
        super().__init__()
        self.max_bytes = max_bytes
        self.parts = []
        self.size = 0
        self.full = False

    def writable(self):
        return True

    def write(self, text):
        text = str(text)
        if self.full:
            return len(text)
        data = text.encode("utf-8", "replace")
        if self.size + len(data) > self.max_bytes:
            room = self.max_bytes - self.size
            self.parts.append(data[:room].decode("utf-8", "ignore") + "\n… (output truncated)")
            self.full = True
        else:
            self.parts.append(text)
            self.size += len(data)
        return len(text)

    def take(self):
        text = "".join(self.parts)
        self.parts, self.size, self.full = [], 0, False
        return text


class TimeLimit(BaseException):
    """Raised by the SIGALRM handler. BaseException so `except Exception` in user code can't swallow it."""


def on_alarm(signum, frame):
    raise TimeLimit()


def user_traceback(exc):
    """Traceback limited to frames in the user's file."""
    frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename == "solution.py"]
    lines = []
    if frames:
        lines.append("Traceback (most recent call last):\n")
        lines.extend(traceback.format_list(frames))
    lines.extend(traceback.format_exception_only(type(exc), exc))
    return "".join(lines).rstrip()


def main():
    # Read all of stdin before any user code runs.
    config = json.loads(sys.stdin.read())
    function_name = config["functionName"]
    time_limit = config["timeLimitMs"] / 1000
    results_file = config["resultsFile"]
    tests = config["tests"]
    logs = LogBuffer(config["maxLogBytes"])

    def emit(record):
        with open(results_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

    def run_limited(fn, *args):
        signal.setitimer(signal.ITIMER_REAL, time_limit)
        try:
            with contextlib.redirect_stdout(logs), contextlib.redirect_stderr(logs):
                return fn(*args)
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)

    signal.signal(signal.SIGALRM, on_alarm)
    sys.setrecursionlimit(10_000)

    with open("solution.py", encoding="utf-8") as f:
        source = f.read()
    try:
        code = compile(source, "solution.py", "exec")
    except (SyntaxError, ValueError) as exc:
        message = "".join(traceback.format_exception_only(type(exc), exc)).rstrip()
        emit({"type": "compile_error", "message": message})
        emit({"type": "done"})
        return

    namespace = {"__name__": "solution", "__builtins__": __builtins__}
    setup_error = None
    try:
        run_limited(exec, code, namespace)
    except TimeLimit:
        setup_error = "Time limit exceeded while loading your code"
    except BaseException as exc:  # noqa: BLE001 - report anything the user's code raised
        setup_error = user_traceback(exc)

    fn = namespace.get(function_name)
    if setup_error is None and not callable(fn):
        setup_error = f'{function_name} is not defined. Your code must define a function named "{function_name}".'
    emit({"type": "setup", "error": setup_error, "logs": logs.take()})
    if setup_error is not None:
        emit({"type": "done"})
        return

    for index, args in enumerate(tests):
        record = {"type": "test", "index": index}
        start = time.perf_counter()
        try:
            result = run_limited(fn, *args)
            try:
                record["actual"] = json.loads(json.dumps(result, allow_nan=False))
                record["status"] = "ok"
            except (TypeError, ValueError) as exc:
                record["status"] = "error"
                record["error"] = f"Return value is not JSON-serializable: {exc}"
        except TimeLimit:
            record["status"] = "timeout"
        except MemoryError:
            record["status"] = "memory"
        except BaseException as exc:  # noqa: BLE001
            record["status"] = "error"
            record["error"] = user_traceback(exc)
        record["timeMs"] = round((time.perf_counter() - start) * 1000, 2)
        record["logs"] = logs.take()
        emit(record)

    emit({"type": "done"})


main()
