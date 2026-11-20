import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import DifficultyBadge from '@/components/DifficultyBadge.jsx';
import FormError from '@/components/FormError.jsx';
import Spinner from '@/components/Spinner.jsx';
import { api } from '@/lib/api.js';

function SolvedMark({ solved }) {
  return solved ? (
    <svg
      viewBox="0 0 20 20"
      className="size-5 text-emerald-400"
      fill="currentColor"
      aria-label="Solved"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  ) : (
    <span className="block size-5 rounded-full border border-zinc-700" aria-label="Not solved" />
  );
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/problems')
      .then((data) => !cancelled && setProblems(data.problems))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const solvedCount = problems?.filter((p) => p.solved).length ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Home
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Practice problems</h1>
          <p className="text-sm text-zinc-400">Solve them solo, in JavaScript or Python.</p>
        </div>
        {problems && (
          <p className="text-sm text-zinc-400">
            <span className="font-mono text-emerald-400">{solvedCount}</span> / {problems.length}{' '}
            solved
          </p>
        )}
      </header>

      <FormError>{error}</FormError>

      {!problems && !error && (
        <div className="flex justify-center py-16 text-emerald-400">
          <Spinner className="size-7" />
        </div>
      )}

      {problems && (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
          {problems.map((problem) => (
            <li key={problem.id}>
              <Link
                to={`/practice/${problem.slug}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-800/50"
              >
                <SolvedMark solved={problem.solved} />
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">
                  {problem.title}
                </span>
                <DifficultyBadge difficulty={problem.difficulty} />
              </Link>
            </li>
          ))}
          {problems.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-zinc-500">
              No problems yet. Run <code className="font-mono">npm run db:seed</code>.
            </li>
          )}
        </ul>
      )}
    </main>
  );
}
