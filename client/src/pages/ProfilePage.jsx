import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import DifficultyBadge from '@/components/DifficultyBadge.jsx';
import EloDelta from '@/components/EloDelta.jsx';
import FormError from '@/components/FormError.jsx';
import Pagination from '@/components/Pagination.jsx';
import ResultBadge from '@/components/ResultBadge.jsx';
import Spinner from '@/components/Spinner.jsx';
import UserLink from '@/components/UserLink.jsx';
import { formatClock, REASON_LABELS } from '@/components/match/format.js';
import EloChart from '@/components/profile/EloChart.jsx';
import { api } from '@/lib/api.js';
import NotFoundPage from '@/pages/NotFoundPage.jsx';

const LANGUAGE_LABELS = { javascript: 'JavaScript', python: 'Python' };
const MODES = [
  { id: 'all', label: 'All' },
  { id: 'ranked', label: 'Ranked' },
  { id: 'private', label: 'Private' },
];
const formatDate = (iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) =>
  new Date(iso).toLocaleDateString(undefined, opts);

function Stat({ label, children, hint }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold text-zinc-100">{children}</dd>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function SolvedBreakdown({ solved }) {
  const rows = [
    { key: 'EASY', bar: 'bg-emerald-500' },
    { key: 'MEDIUM', bar: 'bg-amber-400' },
    { key: 'HARD', bar: 'bg-red-500' },
  ];
  const max = Math.max(1, ...rows.map((r) => solved[r.key]));
  return (
    <div className="space-y-3">
      {rows.map(({ key, bar }) => (
        <div key={key} className="flex items-center gap-3">
          <div className="w-20 shrink-0">
            <DifficultyBadge difficulty={key} />
          </div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full ${bar}`}
              style={{ width: `${(solved[key] / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-sm text-zinc-200">{solved[key]}</span>
        </div>
      ))}
      <p className="text-xs text-zinc-500">
        {solved.total} distinct problems solved (practice and matches).
      </p>
    </div>
  );
}

function MatchRow({ match }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap">
      <ResultBadge result={match.result} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="text-zinc-500">vs </span>
          <UserLink username={match.opponent.username} className="font-medium text-zinc-100" />
          <span className="ml-1.5 font-mono text-xs text-zinc-500">{match.opponent.elo}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
          <span className="truncate">{match.problem.title}</span>
          <DifficultyBadge difficulty={match.problem.difficulty} />
          <span className="text-zinc-600">·</span>
          <span>{match.mode === 'RANKED' ? 'Ranked' : 'Private'}</span>
          <span className="text-zinc-600">·</span>
          <span>{REASON_LABELS[match.endReason] ?? match.endReason}</span>
          {match.languages.length > 0 && (
            <>
              <span className="text-zinc-600">·</span>
              <span>{match.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(', ')}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-4 text-right text-sm">
        <div className="hidden sm:block">
          <p className="font-mono text-zinc-300">
            {match.passed}/{match.total}
          </p>
          <p className="text-xs text-zinc-500">
            {match.solveTimeMs !== null ? `solved ${formatClock(match.solveTimeMs)}` : 'tests'}
          </p>
        </div>
        <div className="w-12">
          <EloDelta delta={match.eloChange} />
        </div>
        <div className="w-20">
          <p className="text-xs text-zinc-400">
            {formatDate(match.date, { month: 'short', day: 'numeric' })}
          </p>
          <Link
            to={`/matches/${match.id}`}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            Details →
          </Link>
        </div>
      </div>
    </li>
  );
}

function MatchHistory({ username }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = MODES.some((m) => m.id === searchParams.get('mode'))
    ? searchParams.get('mode')
    : 'all';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const key = `${username}|${mode}|${page}`;
  const [state, setState] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/users/${username}/matches?mode=${mode}&page=${page}`)
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch((err) => !cancelled && setState({ key, data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [username, mode, page, key]);

  const loading = state.key !== key;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Match history</h2>
        <div
          className="flex rounded-lg border border-zinc-800 p-0.5"
          role="tablist"
          aria-label="Mode"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setSearchParams(m.id === 'all' ? {} : { mode: m.id })}
              className={`rounded-md px-3 py-1.5 text-sm transition ${mode === m.id ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <FormError>{state.error}</FormError>
      {loading ? (
        <div className="flex justify-center py-10 text-emerald-400">
          <Spinner className="size-6" />
        </div>
      ) : (
        state.data && (
          <>
            <ul className="divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
              {state.data.matches.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
              {state.data.matches.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-zinc-500">No matches yet.</li>
              )}
            </ul>
            <Pagination
              page={state.data.page}
              totalPages={state.data.totalPages}
              onChange={(p) =>
                setSearchParams({ ...(mode !== 'all' && { mode }), page: String(p) })
              }
            />
          </>
        )
      )}
    </section>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const [state, setState] = useState({ username: null, profile: null, points: null, error: null });

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(`/users/${username}/profile`), api.get(`/users/${username}/elo-history`)])
      .then(
        ([{ profile }, { points }]) =>
          !cancelled && setState({ username, profile, points, error: null }),
      )
      .catch((error) => !cancelled && setState({ username, profile: null, points: null, error }));
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (state.username !== username) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-emerald-400">
        <Spinner className="size-8" />
      </div>
    );
  }
  if (state.error?.status === 404)
    return (
      <NotFoundPage title="Player not found" message={`There is no player called "${username}".`} />
    );
  if (state.error)
    return (
      <main className="p-8">
        <FormError>{state.error.message}</FormError>
      </main>
    );

  const { profile, points } = state;
  const streak = profile.currentStreak;
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:py-12">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl shadow-black/30 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="truncate text-2xl font-bold tracking-tight sm:text-3xl"
              data-testid="profile-username"
            >
              {profile.username}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Member since {formatDate(profile.memberSince)}
              {profile.favoriteLanguage && (
                <>
                  {' '}
                  · Favorite language:{' '}
                  {LANGUAGE_LABELS[profile.favoriteLanguage] ?? profile.favoriteLanguage}
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">ELO</p>
            <p className="font-mono text-3xl font-bold text-emerald-400" data-testid="profile-elo">
              {profile.elo}
            </p>
            <p className="text-sm text-zinc-400" data-testid="profile-rank">
              {profile.rank ? `Rank #${profile.rank}` : 'Unranked'}
            </p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Best ELO">{profile.bestElo}</Stat>
          <Stat label="W / L / D" hint="ranked">
            <span className="text-emerald-400">{profile.wins}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-red-400">{profile.losses}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-300">{profile.draws}</span>
          </Stat>
          <Stat label="Win rate" hint={`${profile.gamesPlayed} ranked games`}>
            {profile.winRate}%
          </Stat>
          <Stat label="Streak">
            {streak ? (
              <span className={streak.type === 'W' ? 'text-emerald-400' : 'text-red-400'}>
                {streak.count}
                {streak.type}
              </span>
            ) : (
              '—'
            )}
          </Stat>
          <Stat label="Best win streak">{profile.longestWinStreak}</Stat>
          <Stat label="Solved">{profile.solved.total}</Stat>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-lg font-semibold">ELO history</h2>
          <EloChart points={points} />
        </section>
        <section className="min-w-0 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-lg font-semibold">Problems solved</h2>
          <SolvedBreakdown solved={profile.solved} />
        </section>
      </div>

      <MatchHistory username={profile.username} />
    </main>
  );
}
