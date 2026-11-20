import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import FullPageSpinner from '@/components/FullPageSpinner.jsx';
import GuestRoute from '@/components/GuestRoute.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import AppLayout from '@/components/layout/AppLayout.jsx';
import { usePlaySession } from '@/hooks/usePlaySession.js';
import { useSocketLifecycle } from '@/hooks/useSocketLifecycle.js';
import HomePage from '@/pages/HomePage.jsx';
import JoinRoomPage from '@/pages/JoinRoomPage.jsx';
import LeaderboardPage from '@/pages/LeaderboardPage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import ProblemsPage from '@/pages/ProblemsPage.jsx';
import ProfilePage from '@/pages/ProfilePage.jsx';
import RegisterPage from '@/pages/RegisterPage.jsx';
import StatusPage from '@/pages/StatusPage.jsx';

// These pages bundle Monaco (several MB): load them only when needed.
const PracticePage = lazy(() => import('@/pages/PracticePage.jsx'));
const MatchPage = lazy(() => import('@/pages/MatchPage.jsx'));
const MatchDetailsPage = lazy(() => import('@/pages/MatchDetailsPage.jsx'));

const lazyPage = (Page) => (
  <Suspense fallback={<FullPageSpinner />}>
    <Page />
  </Suspense>
);

export default function App() {
  useSocketLifecycle();
  usePlaySession();

  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        {/* Logged-in pages with the global navbar */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/problems" element={<ProblemsPage />} />
          <Route path="/practice/:slug" element={lazyPage(PracticePage)} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/matches/:id" element={lazyPage(MatchDetailsPage)} />
          <Route path="/join/:code" element={<JoinRoomPage />} />
        </Route>
        {/* Focus mode: the arena has its own minimal header */}
        <Route path="/match/:id" element={lazyPage(MatchPage)} />
      </Route>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route path="/dev/status" element={<StatusPage />} />
      <Route
        path="*"
        element={
          <div className="flex min-h-dvh flex-col">
            <NotFoundPage />
          </div>
        }
      />
    </Routes>
  );
}
