import { useState } from 'react';
import { Link } from 'react-router';
import Button from '@/components/Button.jsx';
import { useAuthStore } from '@/store/authStore.js';

function Stat({ label, value, className = 'text-zinc-100' }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-center">
      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className={`mt-1 font-mono text-2xl font-semibold ${className}`}>{value}</dd>
    </div>
  );
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout(); // ProtectedRoute then redirects to /login
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/30">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-zinc-400">Welcome back,</p>
            <h1 className="truncate text-2xl font-bold tracking-tight">{user.username}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">ELO</p>
            <p className="font-mono text-3xl font-bold text-emerald-400">{user.elo}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Wins" value={user.wins} className="text-emerald-400" />
          <Stat label="Losses" value={user.losses} className="text-red-400" />
          <Stat label="Draws" value={user.draws} className="text-zinc-300" />
        </dl>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/problems"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            Practice problems →
          </Link>
          <Button variant="secondary" loading={loggingOut} onClick={handleLogout}>
            Log out
          </Button>
        </div>
        <p className="mt-4 text-xs text-zinc-500">1v1 matchmaking is coming in the next phase.</p>
      </section>

      {import.meta.env.DEV && (
        <Link to="/dev/status" className="text-center text-sm text-zinc-500 hover:text-zinc-300">
          Dev status →
        </Link>
      )}
    </main>
  );
}
