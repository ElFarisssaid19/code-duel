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
import { useState } from 'react';
import { api } from '@/lib/api.js';
import TrackBadge from '@/components/frontend/TrackBadge.jsx';
import GhostName from '@/components/match/GhostName.jsx';
import ShareModal from '@/components/match/ShareModal.jsx';
import Button from '@/components/ui/Button.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useAuthStore } from '@/store/authStore.js';
import { CATEGORY_LABELS, formatScore, LANGUAGE_LABELS } from '@/lib/categories.js';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
/** FRONTEND submissions are "solved" or not (a score), never "wrong answer". */
function SubmissionStatus({ submission }) {
  if (submission.score === undefined || submission.score === null) {
    return <StatusBadge status={submission.status} />;
  }
  return submission.status === 'ACCEPTED' ? (
    <Badge tone="success">Solved</Badge>
  ) : (
    <Badge tone="neutral">Below threshold</Badge>
  );
}

const STATUS_TEXT = {
  WAITING: 'Waiting',
  COUNTDOWN: 'Starting',
  ACTIVE: 'In progress',
  FINISHED: 'Finished',
  CANCELLED: 'Cancelled',
};

function PlayerCard({ player, winner, testCount, frontend }) {
  return (
    <Card padding="p-4" glow={winner ? 'accent' : undefined} className="min-w-0 flex-1">
      <div className="flex items-center gap-3">
        <ResultBadge result={player.result} />
        <div className="min-w-0">
          {player.ghost ? (
            <GhostName ghost={player.ghost} className="text-ink" />
          ) : (
            <UserLink
              username={player.username}
              className="block truncate font-semibold text-ink"
            />
          )}
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
        {frontend ? (
          <>
            <div>
              <dt className="text-xs text-ink-subtle">Best score</dt>
              <dd className="font-mono text-zinc-200" data-testid="player-best-score">
                {formatScore(player.score)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-subtle">Characters</dt>
              <dd className="font-mono text-zinc-200">{player.charCount ?? '—'}</dd>
            </div>
          </>
        ) : (
          <AlgoStats player={player} testCount={testCount} />
        )}
      </dl>
    </Card>
  );
}

function AlgoStats({ player, testCount }) {
  return (
    <>
      <div>
        <dt className="text-xs text-ink-subtle">Tests passed</dt>
        <dd className="font-mono text-zinc-200">
          {player.passed}/{testCount}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-ink-subtle">
          {player.linesChanged !== undefined ? 'Lines changed' : 'Solve time'}
        </dt>
        <dd className="font-mono text-zinc-200">
          {player.linesChanged !== undefined
            ? (player.linesChanged ?? '—')
            : player.solveTimeMs !== null
              ? formatClock(player.solveTimeMs)
              : '—'}
        </dd>
      </div>
    </>
  );
}

/** One final render (or a placeholder when the player never submitted). */
function PreviewImage({ url, width, height, label }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="grid place-items-center rounded-md border border-dashed border-line-strong text-sm text-ink-subtle"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        No submission
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      width={width}
      height={height}
      onError={() => setFailed(true)}
      className="block h-auto w-full rounded-md ring-1 ring-line-strong"
      data-testid="final-preview"
    />
  );
}

/** FRONTEND: the target and each player's best submission, rendered by the official renderer. */
function FinalPreviews({ match }) {
  const { width, height } = match.canvas;
  if (!match.previews.available) {
    return (
      <Card padding="p-0">
        <EmptyState
          icon="🔒"
          title="Previews are hidden"
          description="The final previews appear once the match has finished."
        />
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <figure className="min-w-0 space-y-2">
        <figcaption className="text-sm font-semibold text-zinc-300">Target</figcaption>
        <img
          src={`/api/problems/${match.problem.slug}/target.png`}
          alt="Target"
          width={width}
          height={height}
          className="block h-auto w-full rounded-md ring-1 ring-line-strong"
        />
      </figure>
      {match.previews.players.map(({ userId, url }) => {
        const player = match.players.find((p) => p.userId === userId);
        return (
          <figure key={userId} className="min-w-0 space-y-2">
            <figcaption className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <UserLink username={player.username} />
              <span className="font-mono font-normal text-ink-muted">
                {formatScore(player.score)}
              </span>
            </figcaption>
            <PreviewImage
              url={url}
              width={width}
              height={height}
              label={`${player.username}'s final render`}
            />
          </figure>
        );
      })}
    </div>
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
              {player.ghost ? (
                <GhostName ghost={player.ghost} compact />
              ) : (
                <UserLink username={player.username} />
              )}{' '}
              {!player.ghost && (
                <span className="font-normal text-ink-subtle">
                  · {entries.length} submission{entries.length === 1 ? '' : 's'}
                </span>
              )}
            </h3>
            {player.ghost ? (
              <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-sm text-ink-subtle">
                A replay: its progress was replayed live during the match. Replays never show code.
              </p>
            ) : entries.length === 0 ? (
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
                    <SubmissionStatus submission={t} />
                    <span className="font-mono text-zinc-200">
                      {t.score !== undefined ? formatScore(t.score) : `${t.passed}/${t.total}`}
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

/** A FRONTEND submission: the HTML and/or CSS the player wrote (per track). */
function FrontendCode({ submission, track, path }) {
  const parts = [
    track !== 'CSS' && { id: 'html', code: submission.code },
    track !== 'HTML' && { id: 'css', code: submission.css ?? '' },
  ].filter(Boolean);
  return parts.map((part) => (
    <div
      key={part.id}
      className="flex min-h-0 flex-1 flex-col border-b border-line last:border-b-0"
    >
      <p className="px-3 py-1 text-xs font-medium text-ink-subtle uppercase">{part.id}</p>
      <div className="min-h-0 flex-1">
        <ReadOnlyCode code={part.code} language={part.id} path={`${path}/index.${part.id}`} />
      </div>
    </div>
  ));
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
                  <SubmissionStatus submission={submission} />
                  <span className="font-mono text-ink-muted">
                    {submission.score !== undefined
                      ? formatScore(submission.score)
                      : `${submission.passed}/${submission.total}`}
                  </span>
                  <span className="text-ink-subtle">
                    · {LANGUAGE_LABELS[submission.language] ?? submission.language}
                  </span>
                </>
              )}
            </div>
            <div
              className="flex h-80 flex-col overflow-hidden rounded-xl border border-line"
              data-testid="final-code"
            >
              {submission && match.category === 'FRONTEND' ? (
                <FrontendCode
                  submission={submission}
                  track={match.track}
                  path={`match-details-${match.id}/${userId}`}
                />
              ) : submission ? (
                <ReadOnlyCode
                  code={submission.code}
                  language={submission.language}
                  path={`match-details-${match.id}/${userId}`}
                />
              ) : (
                <EmptyState
                  icon="{ }"
                  title={player.ghost ? 'No code for replays' : 'No submission'}
                  description={
                    player.ghost
                      ? 'Ghosts and bots never show code.'
                      : `${player.username} never submitted code.`
                  }
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

/** Participants of a finished match: share the result card, see the link, revoke it. */
function ShareControls({ match }) {
  const me = useAuthStore((s) => s.user);
  const participant = match.players.some((p) => p.userId === me?.id);
  const shareable = participant && match.status === 'FINISHED';
  const { data, retry } = useApi(shareable ? `/matches/${match.id}/share` : null);
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  if (!shareable) return null;
  const share = data?.share;

  async function revoke() {
    setRevoking(true);
    try {
      await api.delete(`/matches/${match.id}/share`);
    } finally {
      setRevoking(false);
      retry();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="share-controls">
      <Button size="sm" onClick={() => setOpen(true)}>
        Share result
      </Button>
      {share && (
        <>
          <span className="truncate font-mono text-xs text-ink-muted" data-testid="share-link">
            {share.url}
          </span>
          <Button size="sm" variant="danger-outline" onClick={revoke} loading={revoking}>
            Revoke link
          </Button>
        </>
      )}
      {open && (
        <ShareModal
          open
          matchId={match.id}
          onClose={() => {
            setOpen(false);
            retry();
          }}
          onRevoke={() => {
            setOpen(false);
            retry();
          }}
        />
      )}
    </div>
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
  const frontend = match.category === 'FRONTEND';
  const modeLabel = { RANKED: 'Ranked', PRIVATE: 'Private', GHOST: 'Ghost' }[match.mode];
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:py-12">
      <header className="space-y-4 motion-safe:animate-fade-up">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-muted">
          <Badge tone={match.mode === 'RANKED' ? 'accent' : 'info'}>{modeLabel}</Badge>
          {match.category && match.category !== 'ALGO' && (
            <Badge tone="info">{CATEGORY_LABELS[match.category]}</Badge>
          )}
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
          {frontend && <TrackBadge track={match.track} />}
        </h1>
        <ShareControls match={match} />
        <div className="flex flex-col gap-3 sm:flex-row">
          {match.players.map((p) => (
            <PlayerCard
              key={p.userId}
              player={p}
              winner={p.userId === match.winnerId}
              testCount={match.testCount}
              frontend={frontend}
            />
          ))}
        </div>
      </header>

      {frontend && (
        <section className="space-y-4" aria-labelledby="previews-title">
          <h2 id="previews-title" className="text-lg font-semibold">
            Final previews
          </h2>
          <FinalPreviews match={match} />
        </section>
      )}

      <section className="space-y-4" aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="text-lg font-semibold">
          {frontend ? 'Score timeline' : 'Submission timeline'}
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
