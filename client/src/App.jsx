import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import FullPageSpinner from '@/components/FullPageSpinner.jsx';
import GuestRoute from '@/components/GuestRoute.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import { useSocketLifecycle } from '@/hooks/useSocketLifecycle.js';
import HomePage from '@/pages/HomePage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import ProblemsPage from '@/pages/ProblemsPage.jsx';
import RegisterPage from '@/pages/RegisterPage.jsx';
import StatusPage from '@/pages/StatusPage.jsx';

// The practice page bundles Monaco (several MB): load it only when needed.
const PracticePage = lazy(() => import('@/pages/PracticePage.jsx'));

export default function App() {
  useSocketLifecycle();

  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/problems" element={<ProblemsPage />} />
        <Route
          path="/practice/:slug"
          element={
            <Suspense fallback={<FullPageSpinner />}>
              <PracticePage />
            </Suspense>
          }
        />
      </Route>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route path="/dev/status" element={<StatusPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
