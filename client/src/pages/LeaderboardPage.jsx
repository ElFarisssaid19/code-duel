import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import FormError from '@/components/FormError.jsx';
import Pagination from '@/components/Pagination.jsx';
import Spinner from '@/components/Spinner.jsx';
import UserLink from '@/components/UserLink.jsx';
import { api } from '@/lib/api.js';

const LIMIT = 20;
const MEDALS = {
  1: 'bg-amber-400/15 text-amber-300 ring-amber-400/40',
  2: 'bg-zinc-300/10 text-zinc-200 ring-zinc-300/30',
  3: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
};

function Row({ entry, mine, sticky = false }) {
  const medal = MEDALS[entry.rank];
  return (
    <tr
      className={`${mine ? 'bg-emerald-500/10' : medal ? 'bg-zinc-900/80' : ''} ${
        sticky
          ? 'sticky bottom-0 border-t-2 border-emerald-500/40 bg-zinc-950 shadow-[0_-8px_16px_rgba(0,0,0,0.5)]'
          : ''
      }`}
      aria-current={mine ? 'true' : undefined}
    >
      <td className="px-3 py-3 sm:px-4">
        <span
          className={`inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-sm font-bold ${
            medal ? `ring-1 ring-inset ${medal}` : 'text-zinc-400'
          }`}
        >
          #{entry.rank}
        </span>
      </td>
      <td className="max-w-[9rem] truncate px-3 py-3 font-medium sm:max-w-none sm:px-4">
        <UserLink
          username={entry.username}
          className={mine ? 'text-emerald-300' : 'text-zinc-100'}
        />
        {mine && <span className="ml-2 text-xs text-emerald-400">(you)</span>}
      </td>
      <td className="px-3 py-3 text-right font-mono font-semibold text-zinc-100 sm:px-4">
        {entry.elo}
      </td>
      <td className="hidden px-4 py-3 text-right font-mono text-sm sm:table-cell">
        <span className="text-emerald-400">{entry.wins}</span>
        <span className="text-zinc-600"> / </span>
        <span className="text-red-400">{entry.losses}</span>
        <span className="text-zinc-600"> / </span>
        <span className="text-zinc-300">{entry.draws}</span>
      </td>
      <td className="px-3 py-3 text-right font-mono text-sm text-zinc-300 sm:px-4">
        {entry.winRate}%
      </td>
      <td className="hidden px-4 py-3 text-right font-mono text-sm text-zinc-400 md:table-cell">
        {entry.gamesPlayed}
      </td>
    </tr>
  );
}

export default function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [state, setState] = useState({ page: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/leaderboard?page=${page}&limit=${LIMIT}`)
      .then((data) => !cancelled && setState({ page, data, error: null }))
      .catch((err) => !cancelled && setState({ page, data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [page]);

  const { data, error } = state;
  const loading = state.page !== page;
  const me = data?.me;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-zinc-400">
            Ranked players by ELO. Private matches don&apos;t count.
          </p>
        </div>
        {me ? (
          <p className="text-sm text-zinc-400">
            Your rank: <span className="font-mono font-semibold text-emerald-400">#{me.rank}</span>
          </p>
        ) : (
          data && <p className="text-sm text-zinc-500">Play a ranked match to get a rank.</p>
        )}
      </header>

      <FormError>{error}</FormError>
      {loading && !error && (
        <div className="flex justify-center py-16 text-emerald-400">
          <Spinner className="size-7" />
        </div>
      )}

      {!loading && data && (
        <>
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-left">
              <thead className="border-b border-zinc-800 text-xs tracking-wide text-zinc-500 uppercase">
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
              <tbody className="divide-y divide-zinc-800/80">
                {data.entries.map((entry) => (
                  <Row key={entry.userId} entry={entry} mine={entry.userId === me?.userId} />
                ))}
                {data.entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                      Nobody has played a ranked match yet.
                    </td>
                  </tr>
                )}
                {me && !me.onPage && <Row entry={me} mine sticky />}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(p) => setSearchParams({ page: String(p) })}
          />
        </>
      )}
    </main>
  );
}
