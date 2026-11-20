import { Link, useParams, useSearchParams } from 'react-router';
import DifficultyBadge from '@/components/DifficultyBadge.jsx';
import EloDelta from '@/components/EloDelta.jsx';
import Pagination from '@/components/Pagination.jsx';
import ResultBadge from '@/components/ResultBadge.jsx';
import UserLink from '@/components/UserLink.jsx';
import { formatClock, REASON_LABELS } from '@/components/match/format.js';
import EloChart from '@/components/profile/EloChart.jsx';
import Card from '@/components/ui/Card.jsx';
import EmptyState from '@/components/ui/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState.jsx';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton.jsx';
import Tabs from '@/components/ui/Tabs.jsx';
import { buttonClasses } from '@/components/ui/styles.js';
import { useApi } from '@/hooks/useApi.js';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  formatScore,
  isCategory,
  LANGUAGE_LABELS,
  TRACK_LABELS,
} from '@/lib/categories.js';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import { useAuthStore } from '@/store/authStore.js';

const MODES = [
  { id: 'all', label: 'All' },
  { id: 'ranked', label: 'Ranked' },
  { id: 'private', label: 'Private' },
];
const formatDate = (iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) =>
  new Date(iso).toLocaleDateString(undefined, opts);

function Stat({ label, children, hint }) {
  return (
    <div className="rounded-xl border border-line bg-canvas/50 px-4 py-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold text-ink">{children}</dd>
      {hint && <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** ?category= from the URL (ALGO by default) and a setter that keeps the other params. */
function useCategoryParam() {
  const [params, setParams] = useSearchParams();
  const category = isCategory(params.get('category')) ? params.get('category') : 'ALGO';
  const update = (next) => {
    const merged = { category: category === 'ALGO' ? null : category, ...next };
    setParams(
      Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null && v !== undefined)),
    );
  };
  return [category, update, params];
}

function SolvedBreakdown({ solved, own, category }) {
  if (solved.total === 0) {
    return (
      <EmptyState
        icon="✓"
        title="No problems solved yet"
        description={
          own ? 'Solve a practice problem to start filling this in.' : 'Nothing solved so far.'
        }
        action={
          own && (
            <Link
              to={category === 'FRONTEND' ? '/problems?category=FRONTEND' : '/problems'}
              className={buttonClasses({ size: 'sm', variant: 'secondary' })}
            >
              Browse problems
            </Link>
          )
        }
        className="py-6"
      />
    );
  }
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
          <div
            className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800"
            role="img"
            aria-label={`${solved[key]} ${key.toLowerCase()} problems solved`}
          >
            <div
              className={`h-full rounded-full ${bar}`}
              style={{ width: `${(solved[key] / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-sm text-zinc-200">{solved[key]}</span>
        </div>
      ))}
      <p className="text-xs text-ink-subtle">
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
          <span className="text-ink-subtle">vs </span>
          <UserLink username={match.opponent.username} className="font-medium text-ink" />
          <span className="ml-1.5 font-mono text-xs text-ink-subtle">{match.opponent.elo}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          <span className="truncate">{match.problem.title}</span>
          <DifficultyBadge difficulty={match.problem.difficulty} />
          <span aria-hidden="true">·</span>
          <span>{match.mode === 'RANKED' ? 'Ranked' : 'Private'}</span>
          <span aria-hidden="true">·</span>
          <span>{REASON_LABELS[match.endReason] ?? match.endReason}</span>
          {match.track && (
            <>
              <span aria-hidden="true">·</span>
              <span>{TRACK_LABELS[match.track]}</span>
            </>
          )}
          {match.languages.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{match.languages.map((l) => LANGUAGE_LABELS[l] ?? l).join(', ')}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-4 text-right text-sm">
        <div className="hidden sm:block">
          {match.category === 'FRONTEND' ? (
            <>
              <p className="font-mono text-zinc-300">{formatScore(match.score)}</p>
              <p className="text-xs text-ink-subtle">best score</p>
            </>
          ) : (
            <>
              <p className="font-mono text-zinc-300">
                {match.passed}/{match.total}
              </p>
              <p className="text-xs text-ink-subtle">
                {match.solveTimeMs !== null ? `solved ${formatClock(match.solveTimeMs)}` : 'tests'}
              </p>
            </>
          )}
        </div>
        <div className="w-12">
          <EloDelta delta={match.eloChange} />
        </div>
        <div className="w-20">
          <p className="text-xs text-ink-muted">
            {formatDate(match.date, { month: 'short', day: 'numeric' })}
          </p>
          <Link
            to={`/matches/${match.id}`}
            className="rounded text-xs font-medium text-accent hover:text-emerald-300"
            aria-label={`Details of the match against ${match.opponent.username}`}
          >
            Details →
          </Link>
        </div>
      </div>
    </li>
  );
}

function HistorySkeleton() {
  return (
    <SkeletonGroup label="Loading match history">
      <Card padding="p-0" className="divide-y divide-line overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="size-7" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </Card>
    </SkeletonGroup>
  );
}

function MatchHistory({ username, own }) {
  const [category, update, searchParams] = useCategoryParam();
  const mode = MODES.some((m) => m.id === searchParams.get('mode'))
    ? searchParams.get('mode')
    : 'all';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const { data, error, loading, retry } = useApi(
    `/users/${username}/matches?mode=${mode}&page=${page}&category=${category}`,
  );

  return (
    <section className="space-y-4" aria-labelledby="history-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-title" className="text-lg font-semibold">
          Match history
        </h2>
        <Tabs
          variant="pill"
          label="Match mode"
          tabs={MODES}
          value={mode}
          onChange={(id) => update({ mode: id === 'all' ? null : id, page: null })}
        />
      </div>
      {loading && <HistorySkeleton />}
      {error && <ErrorState message={error.message} onRetry={retry} />}
      {data && data.matches.length === 0 && (
        <Card>
          <EmptyState
            icon="⚔"
            title={
              mode === 'all'
                ? `No ${CATEGORY_LABELS[category].toLowerCase()} matches yet`
                : `No ${mode} ${CATEGORY_LABELS[category].toLowerCase()} matches yet`
            }
            description={
              own
                ? 'Finished duels show up here, with links to their details.'
                : 'This player has no finished matches here.'
            }
            action={
              own && (
                <Link to="/" className={buttonClasses({ size: 'sm' })}>
                  Find a match
                </Link>
              )
            }
          />
        </Card>
      )}
      {data && data.matches.length > 0 && (
        <>
          <Card as="ul" padding="p-0" className="divide-y divide-line overflow-hidden">
            {data.matches.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </Card>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(p) => update({ mode: mode === 'all' ? null : mode, page: String(p) })}
          />
        </>
      )}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <SkeletonGroup
      label="Loading profile"
      className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:py-12"
    >
      <Card>
        <div className="flex justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-12 w-20" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </SkeletonGroup>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const me = useAuthStore((s) => s.user);
  const [category, update] = useCategoryParam();
  const profileRes = useApi(`/users/${username}/profile?category=${category}`);
  const historyRes = useApi(`/users/${username}/elo-history?category=${category}`);

  if (profileRes.error?.status === 404)
    return (
      <NotFoundPage title="Player not found" message={`There is no player called "${username}".`} />
    );
  if (profileRes.error || historyRes.error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-12">
        <ErrorState
          message={(profileRes.error ?? historyRes.error).message}
          onRetry={() => {
            profileRes.retry();
            historyRes.retry();
          }}
        />
      </main>
    );
  }
  if (profileRes.loading || historyRes.loading) return <ProfileSkeleton />;

  const profile = profileRes.data.profile;
  const points = historyRes.data.points;
  const own = me?.username === profile.username;
  const streak = profile.currentStreak;
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:py-12">
      <Tabs
        label="Profile category"
        tabs={CATEGORIES}
        value={category}
        onChange={(id) => update({ category: id === 'ALGO' ? null : id, mode: null, page: null })}
      />
      <Card as="section" className="motion-safe:animate-fade-up" aria-label="Player stats">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="truncate text-2xl font-bold tracking-tight sm:text-3xl"
              data-testid="profile-username"
            >
              {profile.username}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Member since {formatDate(profile.memberSince)}
              {profile.favoriteLanguage && (
                <>
                  {' '}
                  · Favorite {category === 'FRONTEND' ? 'track' : 'language'}:{' '}
                  {LANGUAGE_LABELS[profile.favoriteLanguage] ?? profile.favoriteLanguage}
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">{CATEGORY_LABELS[category]} ELO</p>
            <p className="font-mono text-3xl font-bold text-accent" data-testid="profile-elo">
              {profile.elo}
            </p>
            <p className="text-sm text-ink-muted" data-testid="profile-rank">
              {profile.rank ? `Rank #${profile.rank}` : 'No rank yet'}
            </p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Best ELO">{profile.bestElo}</Stat>
          <Stat label="W / L / D" hint="ranked">
            <span className="text-emerald-300">{profile.wins}</span>
            <span className="text-ink-subtle">/</span>
            <span className="text-red-300">{profile.losses}</span>
            <span className="text-ink-subtle">/</span>
            <span className="text-zinc-300">{profile.draws}</span>
          </Stat>
          <Stat label="Win rate" hint={`${profile.gamesPlayed} ranked games`}>
            {profile.winRate}%
          </Stat>
          <Stat label="Streak">
            {streak ? (
              <span className={streak.type === 'W' ? 'text-emerald-300' : 'text-red-300'}>
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
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card as="section" className="min-w-0 space-y-3" padding="p-5" aria-labelledby="elo-title">
          <h2 id="elo-title" className="text-lg font-semibold">
            ELO history
          </h2>
          {points.length < 2 ? (
            <EmptyState
              icon="↗"
              title="No ranked matches yet"
              description={
                own
                  ? 'Your rating history starts with your first ranked duel.'
                  : 'The chart appears after the first ranked match.'
              }
              action={
                own && (
                  <Link
                    to={category === 'FRONTEND' ? '/?category=FRONTEND' : '/'}
                    className={buttonClasses({ size: 'sm' })}
                  >
                    Play ranked
                  </Link>
                )
              }
            />
          ) : (
            <EloChart points={points} />
          )}
        </Card>
        <Card
          as="section"
          className="min-w-0 space-y-4"
          padding="p-5"
          aria-labelledby="solved-title"
        >
          <h2 id="solved-title" className="text-lg font-semibold">
            Problems solved
          </h2>
          <SolvedBreakdown solved={profile.solved} own={own} category={category} />
        </Card>
      </div>

      <MatchHistory username={profile.username} own={own} />
    </main>
  );
}
