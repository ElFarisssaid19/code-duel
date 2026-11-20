import ErrorState from '@/components/ui/ErrorState.jsx';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton.jsx';
import { useApi } from '@/hooks/useApi.js';

function Tile({ label, value, children }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/80 p-5 text-center shadow-card">
      <p className="font-mono text-4xl font-bold text-ink tabular-nums">{value}</p>
      <p className="eyebrow mt-2">{label}</p>
      {children}
    </div>
  );
}

/** Live numbers from GET /api/stats/public (cached 60 s server-side). */
export default function PublicStats() {
  const { data, error, loading, retry } = useApi('/stats/public');
  if (error)
    return (
      <ErrorState title="Live stats are unavailable" message={error.message} onRetry={retry} />
    );
  if (loading) {
    return (
      <SkeletonGroup label="Loading live stats" className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </SkeletonGroup>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-3" data-testid="public-stats">
      <Tile label="Players" value={data.players} />
      <Tile label="Duels finished" value={data.finishedMatches} />
      <Tile label="Problems" value={data.problems.total}>
        <p className="mt-2 text-xs text-ink-muted">
          <span className="text-emerald-300">{data.problems.EASY} easy</span> ·{' '}
          <span className="text-amber-200">{data.problems.MEDIUM} medium</span> ·{' '}
          <span className="text-red-300">{data.problems.HARD} hard</span>
        </p>
      </Tile>
    </div>
  );
}
