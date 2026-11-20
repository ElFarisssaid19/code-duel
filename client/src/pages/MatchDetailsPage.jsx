import { Link, useParams } from 'react-router';
import DifficultyBadge from '@/components/DifficultyBadge.jsx';
import EloDelta from '@/components/EloDelta.jsx';
import ReadOnlyCode from '@/components/ReadOnlyCode.jsx';
import ResultBadge from '@/components/ResultBadge.jsx';
import StatusBadge from '@/components/StatusBadge.jsx';
import UserLink from '@/components/UserLink.jsx';
import { formatClock, REASON_LABELS } from '@/components/match/format.js';
import Badge from '@/components/ui/Badge.jsx';
import Card from '@/components/ui/Card.jsx';
import EmptyState from '@/components/ui/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState.jsx';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton.jsx';
import { useApi } from '@/hooks/useApi.js';
import NotFoundPage from '@/pages/NotFoundPage.jsx';

const LANGUAGE_LABELS = { javascript: 'JavaScript', python: 'Python' };
const STATUS_TEXT = {
  WAITING: 'Waiting',
  COUNTDOWN: 'Starting',
  ACTIVE: 'In progress',
  FINISHED: 'Finished',
  CANCELLED: 'Cancelled',
};

function PlayerCard({ player, winner, testCount }) {
  return (
    <Card padding="p-4" glow={winner ? 'accent' : undefined} className="min-w-0 flex-1">
      <div className="flex items-center gap-3">
        <ResultBadge result={player.result} />
        <div className="min-w-0">
          <UserLink username={player.username} className="block truncate font-semibold text-ink" />
          <p className="font-mono text-xs text-ink-subtle">
            {player.eloBefore}
            {player.eloAfter !== null && ` → ${player.eloAfter}`}
          </p>
        </div>
        <div className="ml-auto text-right">
          <EloDelta delta={player.eloChange} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-ink-subtle">Tests passed</dt>
          <dd className="font-mono text-zinc-200">
            {player.passed}/{testCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">Solve time</dt>
          <dd className="font-mono text-zinc-200">
            {player.solveTimeMs !== null ? formatClock(player.solveTimeMs) : '—'}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function Timeline({ match }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {match.players.map((player) => {
        const entries = match.timeline.filter((t) => t.userId === player.userId);
        return (
          <div key={player.userId} className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-300">
              <UserLink username={player.username} />{' '}
              <span className="font-normal text-ink-subtle">
                · {entries.length} submission{entries.length === 1 ? '' : 's'}
              </span>
            </h3>
            {entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-sm text-ink-subtle">
                No submissions yet.
              </p>
            ) : (
              <ol className="space-y-2 border-l border-line pl-4">
                {entries.map((t) => (
                  <li
                    key={t.id}
                    className="relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface/80 px-3 py-2 text-sm"
                  >
                    <span
                      className="absolute top-1/2 -left-[1.3rem] size-2 -translate-y-1/2 rounded-full bg-zinc-600"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs text-ink-muted">
                      {t.offsetMs !== null ? formatClock(t.offsetMs) : '—'}
                    </span>
                    <StatusBadge status={t.status} />
                    <span className="font-mono text-zinc-200">
                      {t.passed}/{t.total}
                    </span>
                    <span className="ml-auto text-xs text-ink-subtle">
                      {LANGUAGE_LABELS[t.language] ?? t.language}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FinalCode({ match }) {
  const { data, error, loading, retry } = useApi(`/matches/${match.id}/code`);
  if (error)
    return <ErrorState title="Couldn't load the code" message={error.message} onRetry={retry} />;
  if (loading) {
    return (
      <SkeletonGroup label="Loading final code" className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </SkeletonGroup>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.players.map(({ userId, submission }) => {
        const player = match.players.find((p) => p.userId === userId);
        return (
          <div key={userId} className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <UserLink username={player.username} className="font-semibold text-ink" />
              {submission && (
                <>
                  <StatusBadge status={submission.status} />
                  <span className="font-mono text-ink-muted">
                    {submission.passed}/{submission.total}
                  </span>
                  <span className="text-ink-subtle">
                    · {LANGUAGE_LABELS[submission.language] ?? submission.language}
                  </span>
                </>
              )}
            </div>
            <div
              className="h-80 overflow-hidden rounded-xl border border-line"
              data-testid="final-code"
            >
              {submission ? (
                <ReadOnlyCode
                  code={submission.code}
                  language={submission.language}
                  path={`match-details-${match.id}/${userId}`}
                />
              ) : (
                <EmptyState
                  icon="{ }"
                  title="No submission"
                  description={`${player.username} never submitted code.`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <SkeletonGroup
      label="Loading match"
      className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:py-12"
    >
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-8 w-80 max-w-full" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-32 flex-1 rounded-2xl" />
        <Skeleton className="h-32 flex-1 rounded-2xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </SkeletonGroup>
  );
}

export default function MatchDetailsPage() {
  const { id } = useParams();
  const { data, error, loading, retry } = useApi(`/matches/${id}`);

  if (error?.status === 404)
    return <NotFoundPage title="Match not found" message="This match doesn't exist." />;
  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-12">
        <ErrorState message={error.message} onRetry={retry} />
      </main>
    );
  }
  if (loading) return <DetailsSkeleton />;

  const { match } = data;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:py-12">
      <header className="space-y-4 motion-safe:animate-fade-up">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-muted">
          <Badge tone={match.mode === 'RANKED' ? 'accent' : 'info'}>
            {match.mode === 'RANKED' ? 'Ranked' : 'Private'}
          </Badge>
          <span>{STATUS_TEXT[match.status]}</span>
          {match.endReason && <span>· {REASON_LABELS[match.endReason]}</span>}
          {match.durationMs !== null && <span>· {formatClock(match.durationMs)} played</span>}
          {match.endedAt && <span>· {new Date(match.endedAt).toLocaleString()}</span>}
        </div>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
          <Link to={`/practice/${match.problem.slug}`} className="rounded hover:underline">
            {match.problem.title}
          </Link>
          <DifficultyBadge difficulty={match.problem.difficulty} />
        </h1>
        <div className="flex flex-col gap-3 sm:flex-row">
          {match.players.map((p) => (
            <PlayerCard
              key={p.userId}
              player={p}
              winner={p.userId === match.winnerId}
              testCount={match.testCount}
            />
          ))}
        </div>
      </header>

      <section className="space-y-4" aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="text-lg font-semibold">
          Submission timeline
        </h2>
        <Timeline match={match} />
      </section>

      <section className="space-y-4" aria-labelledby="code-title">
        <h2 id="code-title" className="text-lg font-semibold">
          Final code
        </h2>
        {match.code.available ? (
          <FinalCode match={match} />
        ) : (
          <Card padding="p-0">
            <EmptyState
              icon="🔒"
              title="Code is private"
              description={
                match.code.reason === 'MATCH_NOT_FINISHED'
                  ? 'The code will be visible to both players once the match has finished.'
                  : 'Only the two players can see the code of this match.'
              }
            />
            <p className="sr-only" data-testid="code-hidden">
              {match.code.reason}
            </p>
          </Card>
        )}
      </section>
    </main>
  );
}
