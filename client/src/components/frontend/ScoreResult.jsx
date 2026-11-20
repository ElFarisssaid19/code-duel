import Badge from '@/components/ui/Badge.jsx';
import Spinner from '@/components/ui/Spinner.jsx';
import FormError from '@/components/FormError.jsx';
import { formatScore } from '@/lib/categories.js';

/** The official score of the last submission (server render + pixel comparison). */
export default function ScoreResult({ result, error, submitting, threshold }) {
  if (submitting) {
    return (
      <div className="flex items-center gap-3 text-sm text-ink-muted" role="status">
        <Spinner className="size-4 text-accent" />
        Rendering and scoring your page…
      </div>
    );
  }
  if (error) return <FormError>{error.message}</FormError>;
  if (!result) {
    return (
      <p className="text-sm text-ink-muted">
        Submit (<span className="kbd">Ctrl</span>+<span className="kbd">Shift</span>+
        <span className="kbd">Enter</span>) to get your official score. Solved at{' '}
        <span className="font-mono text-ink">{formatScore(threshold)}</span>.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2" data-testid="frontend-result">
      <p className="flex items-baseline gap-2">
        <span
          className={`font-mono text-3xl font-bold ${result.solved ? 'text-emerald-300' : 'text-ink'}`}
          data-testid="frontend-score"
        >
          {formatScore(result.score)}
        </span>
        <span className="text-xs text-ink-subtle">/ {formatScore(result.threshold)} needed</span>
      </p>
      {result.solved ? (
        <Badge tone="success" data-testid="frontend-solved">
          ✓ Solved
        </Badge>
      ) : (
        <Badge tone="warning">Not yet</Badge>
      )}
      <span className="text-xs text-ink-muted">
        <span className="font-mono text-zinc-300">{result.charCount}</span> characters
      </span>
    </div>
  );
}
