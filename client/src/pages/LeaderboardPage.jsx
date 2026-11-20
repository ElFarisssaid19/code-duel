import { Link, useSearchParams } from 'react-router';
import Pagination from '@/components/Pagination.jsx';
import UserLink from '@/components/UserLink.jsx';
import Card from '@/components/ui/Card.jsx';
import EmptyState from '@/components/ui/EmptyState.jsx';
import ErrorState from '@/components/ui/ErrorState.jsx';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton.jsx';
import { buttonClasses } from '@/components/ui/styles.js';
import Tabs from '@/components/ui/Tabs.jsx';
import { useApi } from '@/hooks/useApi.js';
import { CATEGORIES, CATEGORY_LABELS, isCategory } from '@/lib/categories.js';

const LIMIT = 20;
const MEDALS = {
  1: 'bg-amber-400/15 text-amber-200 ring-amber-400/40',
  2: 'bg-zinc-300/10 text-zinc-200 ring-zinc-300/30',
  3: 'bg-orange-500/15 text-orange-200 ring-orange-500/30',
};

function Row({ entry, mine, sticky = false }) {
  const medal = MEDALS[entry.rank];
  return (
    <tr
      className={`${mine ? 'bg-emerald-500/10' : medal ? 'bg-surface-raised/40' : ''} ${
        sticky
          ? 'sticky bottom-0 border-t-2 border-emerald-500/40 bg-canvas shadow-[0_-8px_16px_rgba(0,0,0,0.5)]'
          : ''
      }`}
      aria-current={mine ? 'true' : undefined}
    >
      <td className="px-3 py-3 sm:px-4">
        <span
          className={`inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-sm font-bold ${medal ? `ring-1 ring-inset ${medal}` : 'text-ink-muted'}`}
        >
          #{entry.rank}
        </span>
      </td>
      <td className="max-w-[9rem] truncate px-3 py-3 font-medium sm:max-w-none sm:px-4">
        <UserLink username={entry.username} className={mine ? 'text-emerald-300' : 'text-ink'} />
        {mine && <span className="ml-2 text-xs text-emerald-300">(you)</span>}
      </td>
      <td className="px-3 py-3 text-right font-mono font-semibold text-ink sm:px-4">{entry.elo}</td>
      <td className="hidden px-4 py-3 text-right font-mono text-sm sm:table-cell">
        <span className="text-emerald-300">{entry.wins}</span>
        <span className="text-ink-subtle"> / </span>
        <span className="text-red-300">{entry.losses}</span>
        <span className="text-ink-subtle"> / </span>
        <span className="text-zinc-300">{entry.draws}</span>
      </td>
      <td className="px-3 py-3 text-right font-mono text-sm text-zinc-300 sm:px-4">
        {entry.winRate}%
      </td>
      <td className="hidden px-4 py-3 text-right font-mono text-sm text-ink-muted md:table-cell">
        {entry.gamesPlayed}
      </td>
    </tr>
  );
}

function LeaderboardSkeleton() {
  return (
    <SkeletonGroup label="Loading the leaderboard">
      <Card padding="p-0" className="divide-y divide-line overflow-hidden">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </Card>
    </SkeletonGroup>
  );
}

export default function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const category = isCategory(searchParams.get('category')) ? searchParams.get('category') : 'ALGO';
  const { data, error, loading, retry } = useApi(
    `/leaderboard?page=${page}&limit=${LIMIT}&category=${category}`,
  );
  const me = data?.me;
  const playLink = category === 'FRONTEND' ? '/?category=FRONTEND' : '/';
  const go = (next) =>
    setSearchParams(
      Object.fromEntries(
        Object.entries({ category: category === 'ALGO' ? null : category, ...next }).filter(
          ([, v]) => v !== null && v !== undefined,
        ),
      ),
    );

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="eyebrow">Season ladder</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Leaderboard</h1>
          <p className="text-sm text-ink-muted">
            Ranked players by ELO, one ladder per category. Private matches don&apos;t count.
          </p>
        </div>
        {me && (
          <p className="text-sm text-ink-muted">
            Your rank: <span className="font-mono font-semibold text-accent">#{me.rank}</span>
          </p>
        )}
      </header>

      <Tabs
        label="Leaderboard category"
        tabs={CATEGORIES}
        value={category}
        onChange={(id) => go({ category: id === 'ALGO' ? null : id, page: null })}
      />

      {data && !me && data.entries.length > 0 && (
        <Card padding="p-4" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">No rank yet.</span> Play one ranked{' '}
            {CATEGORY_LABELS[category].toLowerCase()} match to join this leaderboard.
          </p>
          <Link to={playLink} className={buttonClasses({ size: 'sm' })}>
            Play ranked
          </Link>
        </Card>
      )}

      {loading && <LeaderboardSkeleton />}
      {error && <ErrorState message={error.message} onRetry={retry} />}

      {data && data.entries.length === 0 && (
        <Card>
          <EmptyState
            icon="#1"
            title="The ladder is empty"
            description={`Nobody has finished a ranked ${CATEGORY_LABELS[category].toLowerCase()} match yet. Play one and take the first spot.`}
            action={
              <Link to={playLink} className={buttonClasses()}>
                Play ranked
              </Link>
            }
          />
        </Card>
      )}

      {data && data.entries.length > 0 && (
        <>
          <Card padding="p-0" className="overflow-hidden">
            <table className="w-full text-left">
              <caption className="sr-only">
                {CATEGORY_LABELS[category]} leaderboard, page {data.page}
              </caption>
              <thead className="border-b border-line text-xs tracking-wide text-ink-subtle uppercase">
                <tr>
                  <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                    Rank
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                    Player
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium sm:px-4">
                    ELO
                  </th>
                  <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                    W / L / D
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium sm:px-4">
                    Win %
                  </th>
                  <th scope="col" className="hidden px-4 py-3 text-right font-medium md:table-cell">
                    Games
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/80">
                {data.entries.map((entry) => (
                  <Row key={entry.userId} entry={entry} mine={entry.userId === me?.userId} />
                ))}
                {me && !me.onPage && <Row entry={me} mine sticky />}
              </tbody>
            </table>
          </Card>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(p) => go({ page: String(p) })}
          />
        </>
      )}
    </main>
  );
}
