import { Navigate, Outlet, useLocation } from 'react-router';
import FullPageSpinner from '@/components/FullPageSpinner.jsx';
import { useAuthStore } from '@/store/authStore.js';

/**
 * Only for logged-out users (login/register). Once authenticated, which is also what
 * happens right after a successful login, it sends the user where they were headed, or "/".
 */
export default function GuestRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') {
    const from = location.state?.from;
    return <Navigate to={from ? `${from.pathname}${from.search ?? ''}` : '/'} replace />;
  }
  return <Outlet />;
}
