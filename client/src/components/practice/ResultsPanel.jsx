import Spinner from '@/components/Spinner.jsx';
import StatusBadge from '@/components/StatusBadge.jsx';
import TestInput from '@/components/practice/TestInput.jsx';
import ValueBlock from '@/components/practice/ValueBlock.jsx';
import { formatValue } from '@/components/practice/params.js';
import { TONE_CLASSES, verdictOf } from '@/lib/verdicts.js';

function TestTab({ test, active, onClick }) {
  const hidden = test.input === undefined;
  const { tone } = verdictOf(test.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
      }`}
    >
      <span className={`size-2 rounded-full ${TONE_CLASSES[tone].dot}`} aria-hidden="true" />
      {hidden ? `Hidden ${test.index + 1}` : `Case ${test.index + 1}`}
      {hidden && <span className="sr-only">(hidden test)</span>}
    </button>
  );
}

function TestDetails({ test, params }) {
  const hidden = test.input === undefined;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={test.status} />
        {test.timeMs !== null && (
          <span className="font-mono text-xs text-zinc-500">
            {test.timeMs < 1 ? '< 1' : test.timeMs} ms
          </span>
        )}
      </div>

      {hidden ? (
        <p className="text-sm text-zinc-400">
          This is a hidden test: its input and expected output aren&apos;t shown.
        </p>
      ) : (
        <>
          <TestInput input={test.input} params={params} />
          <div className="grid gap-4 sm:grid-cols-2">
            <ValueBlock label="Expected">{formatValue(test.expected)}</ValueBlock>
            <ValueBlock label="Output" tone={test.status === 'WRONG_ANSWER' ? 'danger' : 'default'}>
              {test.status === 'SKIPPED' || (test.actual === null && test.error)
                ? '—'
                : formatValue(test.actual)}
            </ValueBlock>
          </div>
          {test.error && (
            <ValueBlock label="Error" tone="danger">
              {test.error}
            </ValueBlock>
          )}
          {test.logs && (
            <ValueBlock label="Logs" tone="muted">
              {test.logs}
            </ValueBlock>
          )}
        </>
      )}
    </div>
  );
}

/** Bottom panel: summary line ("Accepted 8/8"), one tab per test, and the selected test's details. */
export default function ResultsPanel({ result, running, error, activeTab, onTabChange, params }) {
  if (running) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-sm text-zinc-400">
        <Spinner className="size-5 text-emerald-400" />
        {running === 'submit' ? 'Judging against all tests…' : 'Running sample tests…'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            error.status === 429
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
              : 'border-red-500/40 bg-red-500/10 text-red-300'
          }`}
        >
          {error.message}
        </div>
      )}

      {!result && !error && (
        <p className="py-6 text-center text-sm text-zinc-500">
          Run your code to see results here. <kbd className="kbd">Ctrl</kbd> +{' '}
          <kbd className="kbd">Enter</kbd> runs the samples, <kbd className="kbd">Ctrl</kbd> +{' '}
          <kbd className="kbd">Shift</kbd> + <kbd className="kbd">Enter</kbd> submits.
        </p>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              className={`text-lg font-semibold ${TONE_CLASSES[verdictOf(result.status).tone].text}`}
            >
              {verdictOf(result.status).label} {result.passed}/{result.total}
            </h2>
            <span className="text-xs text-zinc-500">
              {result.mode === 'submit' ? 'All tests' : 'Sample tests'}
              {result.timeMs !== null && ` · CPU ${result.timeMs} ms`}
            </span>
          </div>

          {result.compileError && (
            <ValueBlock label="Compile error" tone="danger">
              {result.compileError}
            </ValueBlock>
          )}

          {result.tests.length > 0 && (
            <>
              <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
                {result.tests.map((test, i) => (
                  <TestTab
                    key={test.index}
                    test={test}
                    active={i === activeTab}
                    onClick={() => onTabChange(i)}
                  />
                ))}
              </div>
              {result.tests[activeTab] && (
                <TestDetails test={result.tests[activeTab]} params={params} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
