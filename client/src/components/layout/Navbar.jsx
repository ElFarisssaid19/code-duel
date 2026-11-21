import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import Logo from '@/components/Logo.jsx';
import MuteToggle from '@/components/MuteToggle.jsx';
import { useAuthStore } from '@/store/authStore.js';

function links(username) {
  return [
    { to: '/', label: 'Play', end: true },
    { to: '/problems', label: 'Practice', also: '/practice/' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: `/u/${username}`, label: 'My profile' },
    { to: '/settings', label: 'Settings' },
  ];
}

const linkClass = (active) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition ${
    active
      ? 'bg-surface-raised text-ink shadow-[inset_0_-2px_0_var(--color-accent)]'
      : 'text-ink-muted hover:bg-surface-raised/60 hover:text-ink'
  }`;

/** Global navigation for logged-in pages (hidden in the match arena). */
export default function Navbar() {
  const user = useAuthStore((s) => s.user);
  const algoElo = user.ratings?.ALGO?.elo ?? user.elo;
  const frontendElo = user.ratings?.FRONTEND?.elo ?? 1000;
  const debugElo = user.ratings?.DEBUG?.elo ?? 1000;
  const logout = useAuthStore((s) => s.logout);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => {
    const id = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  const items = links(user.username).map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        linkClass(isActive || (item.also && pathname.startsWith(item.also)))
      }
    >
      {item.label}
    </NavLink>
  ));

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4" aria-label="Main">
        <Link to="/" className="mr-2 shrink-0 rounded-md" aria-label="Code Duel, play">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 lg:flex">{items}</div>

        <div className="ml-auto flex items-center gap-1.5">
          <MuteToggle />
          <Link
            to={`/u/${user.username}`}
            className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition ring-inset hover:bg-emerald-500/20"
            title="Your ELO: Algorithms · Frontend · Debug"
            aria-label={`Your ELO: ${algoElo} in Algorithms, ${frontendElo} in Frontend, ${debugElo} in Debug. Open your profile`}
            data-testid="nav-elo"
          >
            <span>
              <span
                className="mr-1 text-[0.65rem] font-medium text-emerald-300/70"
                aria-hidden="true"
              >
                A
              </span>
              {algoElo}
            </span>
            <span className="text-emerald-300/40" aria-hidden="true">
              ·
            </span>
            <span className="text-sky-300" data-testid="nav-elo-frontend">
              <span className="mr-1 text-[0.65rem] font-medium text-sky-300/70" aria-hidden="true">
                F
              </span>
              {frontendElo}
            </span>
            <span className="text-emerald-300/40" aria-hidden="true">
              ·
            </span>
            <span className="text-amber-200" data-testid="nav-elo-debug">
              <span
                className="mr-1 text-[0.65rem] font-medium text-amber-200/70"
                aria-hidden="true"
              >
                D
              </span>
              {debugElo}
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="hidden rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-surface-raised/60 hover:text-ink disabled:opacity-60 lg:block"
          >
            Log out
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-300 transition hover:bg-surface-raised lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden="true">
              {open ? (
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              ) : (
                <path d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" />
              )}
            </svg>
          </button>
        </div>
      </nav>
      {open && (
        <div
          id="mobile-menu"
          className="flex flex-col gap-1 border-t border-line px-4 py-3 lg:hidden"
        >
          {items}
          <button type="button" onClick={handleLogout} className={`${linkClass(false)} text-left`}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
