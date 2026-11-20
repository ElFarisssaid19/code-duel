import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import DifficultyBadge from '@/components/DifficultyBadge.jsx';
import EloDelta from '@/components/EloDelta.jsx';
import FormError from '@/components/FormError.jsx';
import ReadOnlyCode from '@/components/ReadOnlyCode.jsx';
import ResultBadge from '@/components/ResultBadge.jsx';
import Spinner from '@/components/Spinner.jsx';
import StatusBadge from '@/components/StatusBadge.jsx';
import UserLink from '@/components/UserLink.jsx';
import { formatClock, REASON_LABELS } from '@/components/match/format.js';
import { api } from '@/lib/api.js';
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
    <div
      className={`min-w-0 flex-1 rounded-xl border p-4 ${winner ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/40'}`}
    >
      <div className="flex items-center gap-3">
        <ResultBadge result={player.result} />
        <div className="min-w-0">
          <UserLink
            username={player.username}
            className="block truncate font-semibold text-zinc-100"
          />
          <p className="font-mono text-xs text-zinc-500">
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
          <dt className="text-xs text-zinc-500">Tests passed</dt>
          <dd className="font-mono text-zinc-200">
            {player.passed}/{testCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Solve time</dt>
          <dd className="font-mono text-zinc-200">
            {player.solveTimeMs !== null ? formatClock(player.solveTimeMs) : '—'}
          </dd>
        </div>
      </dl>
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
              <UserLink username={player.username} />{' '}
              <span className="font-normal text-zinc-500">
                · {entries.length} submission{entries.length === 1 ? '' : 's'}
              </span>
            </h3>
            <ol className="space-y-2 border-l border-zinc-800 pl-4">
              {entries.map((t) => (
                <li
                  key={t.id}
                  className="relative flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-zinc-900/60 px-3 py-2 text-sm"
                >
                  <span
                    className="absolute top-1/2 -left-[1.3rem] size-2 -translate-y-1/2 rounded-full bg-zinc-600"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-xs text-zinc-400">
                    {t.offsetMs !== null ? formatClock(t.offsetMs) : '—'}
                  </span>
                  <StatusBadge status={t.status} />
                  <span className="font-mono text-zinc-200">
                    {t.passed}/{t.total}
                  </span>
                  <span className="ml-auto text-xs text-zinc-500">
                    {LANGUAGE_LABELS[t.language] ?? t.language}
                  </span>
                </li>
              ))}
              {entries.length === 0 && <li className="text-sm text-zinc-500">No submissions.</li>}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

function FinalCode({ match }) {
  const [state, setState] = useState({ data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/matches/${match.id}/code`)
      .then((data) => !cancelled && setState({ data, error: null }))
      .catch((error) => !cancelled && setState({ data: null, error }));
    return () => {
      cancelled = true;
    };
  }, [match.id]);

  if (state.error) return <FormError>{state.error.message}</FormError>;
  if (!state.data) return <Spinner className="size-6 text-emerald-400" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {state.data.players.map(({ userId, submission }) => {
        const player = match.players.find((p) => p.userId === userId);
        return (
          <div key={userId} className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <UserLink username={player.username} className="font-semibold text-zinc-100" />
              {submission && (
                <>
                  <StatusBadge status={submission.status} />
                  <span className="font-mono text-zinc-400">
                    {submission.passed}/{submission.total}
                  </span>
                  <span className="text-zinc-500">
                    · {LANGUAGE_LABELS[submission.language] ?? submission.language}
                  </span>
                </>
              )}
            </div>
            <div
              className="h-80 overflow-hidden rounded-xl border border-zinc-800"
              data-testid="final-code"
            >
              {submission ? (
                <ReadOnlyCode
                  code={submission.code}
                  language={submission.language}
                  path={`match-details-${match.id}/${userId}`}
                />
              ) : (
                <p className="p-4 text-sm text-zinc-500">No submission.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MatchDetailsPage() {
  const { id } = useParams();
  const [state, setState] = useState({ id: null, match: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/matches/${id}`)
      .then(({ match }) => !cancelled && setState({ id, match, error: null }))
      .catch((error) => !cancelled && setState({ id, match: null, error }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.id !== id) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-emerald-400">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (state.error?.status === 404)
    return <NotFoundPage title="Match not found" message="This match doesn't exist." />;
  if (state.error)
    return (
      <main className="p-8">
        <FormError>{state.error.message}</FormError>
      </main>
    );

  const { match } = state;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:py-12">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-400">
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-200 uppercase">
            {match.mode === 'RANKED' ? 'Ranked' : 'Private'}
          </span>
          <span>{STATUS_TEXT[match.status]}</span>
          {match.endReason && <span>· {REASON_LABELS[match.endReason]}</span>}
          {match.durationMs !== null && <span>· {formatClock(match.durationMs)} played</span>}
          {match.endedAt && <span>· {new Date(match.endedAt).toLocaleString()}</span>}
        </div>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight">
          <Link to={`/practice/${match.problem.slug}`} className="hover:underline">
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Submission timeline</h2>
        <Timeline match={match} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Final code</h2>
        {match.code.available ? (
          <FinalCode match={match} />
        ) : (
          <p
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-6 text-sm text-zinc-400"
            data-testid="code-hidden"
          >
            {match.code.reason === 'MATCH_NOT_FINISHED'
              ? 'The code will be visible to both players once the match has finished.'
              : 'Only the two players can see the code of this match.'}
          </p>
        )}
      </section>
    </main>
  );
}
