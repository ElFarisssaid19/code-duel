import { Outlet } from 'react-router';
import Navbar from '@/components/layout/Navbar.jsx';

/** Logged-in pages: navbar + page. (The match arena renders without it.) */
export default function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
