import { Navigate, Outlet, useLocation } from 'react-router';
import FullPageSpinner from '@/components/FullPageSpinner.jsx';
import { useAuthStore } from '@/store/authStore.js';

/** Only for logged-in users. Guests go to /login, remembering where they were headed. */
export default function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
