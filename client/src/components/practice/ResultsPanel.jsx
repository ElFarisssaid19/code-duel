import StatusBadge from '@/components/StatusBadge.jsx';
import TestInput from '@/components/practice/TestInput.jsx';
import ValueBlock from '@/components/practice/ValueBlock.jsx';
import { formatValue } from '@/components/practice/params.js';
import Spinner from '@/components/ui/Spinner.jsx';
import Tabs from '@/components/ui/Tabs.jsx';
import { TONE_CLASSES, verdictOf } from '@/lib/verdicts.js';

function TestDetails({ test, params }) {
  const hidden = test.input === undefined;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={test.status} />
        {test.timeMs !== null && (
          <span className="font-mono text-xs text-ink-subtle">
            {test.timeMs < 1 ? '< 1' : test.timeMs} ms
          </span>
        )}
      </div>

      {hidden ? (
        <p className="text-sm text-ink-muted">
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
      <div
        className="flex h-full min-h-40 items-center justify-center gap-3 text-sm text-ink-muted"
        role="status"
      >
        <Spinner className="size-5 text-accent" />
        {running === 'submit' ? 'Judging against all tests…' : 'Running sample tests…'}
      </div>
    );
  }

  const tabs = result?.tests.map((test, i) => ({ id: i, test })) ?? [];
  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className={`rounded-lg border px-3.5 py-2.5 text-sm ${
            error.status === 429
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {error.message}
        </div>
      )}

      {!result && !error && (
        <p className="py-6 text-center text-sm text-ink-subtle">
          Run your code to see results here. <kbd className="kbd">Ctrl</kbd> +{' '}
          <kbd className="kbd">Enter</kbd> runs the samples, <kbd className="kbd">Ctrl</kbd> +{' '}
          <kbd className="kbd">Shift</kbd> + <kbd className="kbd">Enter</kbd> submits.
        </p>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              className={`font-display text-lg font-semibold ${TONE_CLASSES[verdictOf(result.status).tone].text}`}
            >
              {verdictOf(result.status).label} {result.passed}/{result.total}
            </h2>
            <span className="text-xs text-ink-subtle">
              {result.mode === 'submit' ? 'All tests' : 'Sample tests'}
              {result.timeMs !== null && ` · CPU ${result.timeMs} ms`}
            </span>
          </div>

          {result.compileError && (
            <ValueBlock label="Compile error" tone="danger">
              {result.compileError}
            </ValueBlock>
          )}

          {tabs.length > 0 && (
            <>
              <Tabs
                variant="chips"
                label="Test cases"
                tabs={tabs}
                value={activeTab}
                onChange={onTabChange}
                renderTab={({ test }) => {
                  const hidden = test.input === undefined;
                  return (
                    <>
                      <span
                        className={`size-2 rounded-full ${TONE_CLASSES[verdictOf(test.status).tone].dot}`}
                        aria-hidden="true"
                      />
                      {hidden ? `Hidden ${test.index + 1}` : `Case ${test.index + 1}`}
                      <span className="sr-only">{`: ${verdictOf(test.status).label}`}</span>
                    </>
                  );
                }}
              />
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
