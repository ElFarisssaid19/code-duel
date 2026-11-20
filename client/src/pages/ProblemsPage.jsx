import { Link, useSearchParams } from 'react-router';
import DifficultyBadge from '@/components/DifficultyBadge.jsx';
import TrackBadge from '@/components/frontend/TrackBadge.jsx';
import Card from '@/components/ui/Card.jsx';
import EmptyState from '@/components/ui/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState.jsx';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton.jsx';
import Tabs from '@/components/ui/Tabs.jsx';
import { useApi } from '@/hooks/useApi.js';
import { CATEGORIES, formatScore, isCategory, TRACKS } from '@/lib/categories.js';

const TRACK_FILTERS = [{ id: 'ALL', label: 'All tracks' }, ...TRACKS];

function SolvedMark({ solved }) {
  return solved ? (
    <svg
      viewBox="0 0 20 20"
      className="size-5 shrink-0 text-accent"
      fill="currentColor"
      role="img"
      aria-label="Solved"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  ) : (
    <span
      className="block size-5 shrink-0 rounded-full border border-line-strong"
      role="img"
      aria-label="Not solved"
    />
  );
}

function ProblemsSkeleton() {
  return (
    <SkeletonGroup label="Loading problems">
      <Card padding="p-0" className="divide-y divide-line overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </Card>
    </SkeletonGroup>
  );
}

export default function ProblemsPage() {
  const [params, setParams] = useSearchParams();
  const category = isCategory(params.get('category')) ? params.get('category') : 'ALGO';
  const track = TRACKS.some((t) => t.id === params.get('track')) ? params.get('track') : 'ALL';
  const frontend = category === 'FRONTEND';
  const query = new URLSearchParams({ category, ...(frontend && track !== 'ALL' && { track }) });
  const { data, error, loading, retry } = useApi(`/problems?${query}`);
  const problems = data?.problems;
  const solvedCount = problems?.filter((p) => p.solved).length ?? 0;

  const select = (next) => setParams(next, { replace: true });

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="eyebrow">Practice</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Problems</h1>
          <p className="text-sm text-ink-muted">
            {frontend
              ? 'Reproduce a target design with HTML and CSS, scored pixel by pixel.'
              : 'Solve them solo, in JavaScript or Python.'}
          </p>
        </div>
        {problems && (
          <p className="text-sm text-ink-muted">
            <span className="font-mono text-accent">{solvedCount}</span> / {problems.length} solved
          </p>
        )}
      </header>

      <div className="space-y-3">
        <Tabs
          label="Category"
          tabs={CATEGORIES}
          value={category}
          onChange={(id) => select(id === 'ALGO' ? {} : { category: id })}
        />
        {frontend && (
          <Tabs
            variant="chips"
            label="Track"
            tabs={TRACK_FILTERS}
            value={track}
            onChange={(id) => select(id === 'ALL' ? { category } : { category, track: id })}
          />
        )}
      </div>

      {loading && <ProblemsSkeleton />}
      {error && <ErrorState message={error.message} onRetry={retry} />}
      {problems && problems.length === 0 && (
        <Card>
          <EmptyState
            title="No problems yet"
            description="Seed the problem set with npm run db:seed, then come back."
          />
        </Card>
      )}
      {problems && problems.length > 0 && (
        <Card as="ul" padding="p-0" className="divide-y divide-line overflow-hidden">
          {problems.map((problem) => (
            <li key={problem.id}>
              <Link
                to={`/practice/${problem.slug}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-surface-raised/60 focus-visible:-outline-offset-2"
              >
                <SolvedMark solved={problem.solved} />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">
                  {problem.title}
                </span>
                {problem.bestScore !== undefined && problem.bestScore !== null && (
                  <span
                    className="hidden font-mono text-xs text-ink-muted sm:inline"
                    title="Your best score"
                  >
                    best {formatScore(problem.bestScore)}
                  </span>
                )}
                {problem.track && <TrackBadge track={problem.track} />}
                <DifficultyBadge difficulty={problem.difficulty} />
              </Link>
            </li>
          ))}
        </Card>
      )}
    </main>
  );
}
