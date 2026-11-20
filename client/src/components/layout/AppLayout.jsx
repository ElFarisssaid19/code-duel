import { Outlet } from 'react-router';
import ConnectionBanner from '@/components/layout/ConnectionBanner.jsx';
import Navbar from '@/components/layout/Navbar.jsx';

/** Logged-in pages: navbar + page. (The match arena renders without it.) */
export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 font-semibold text-zinc-950 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Navbar />
      <ConnectionBanner />
      <div id="main" className="flex min-w-0 flex-1 flex-col">
        {children ?? <Outlet />}
      </div>
    </div>
  );
}
