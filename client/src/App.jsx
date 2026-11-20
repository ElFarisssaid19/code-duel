import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import FullPageSpinner from '@/components/FullPageSpinner.jsx';
import GuestRoute from '@/components/GuestRoute.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import AppLayout from '@/components/layout/AppLayout.jsx';
import { usePlaySession } from '@/hooks/usePlaySession.js';
import { useSocketLifecycle } from '@/hooks/useSocketLifecycle.js';
import { useAuthStore } from '@/store/authStore.js';

// Route-level code splitting: every page is its own chunk (Monaco only loads with the editor
// pages: practice, match, match details).
const LandingPage = lazy(() => import('@/pages/LandingPage.jsx'));
const HomePage = lazy(() => import('@/pages/HomePage.jsx'));
const LoginPage = lazy(() => import('@/pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage.jsx'));
const ProblemsPage = lazy(() => import('@/pages/ProblemsPage.jsx'));
const PracticePage = lazy(() => import('@/pages/PracticePage.jsx'));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage.jsx'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage.jsx'));
const MatchDetailsPage = lazy(() => import('@/pages/MatchDetailsPage.jsx'));
const MatchPage = lazy(() => import('@/pages/MatchPage.jsx'));
const JoinRoomPage = lazy(() => import('@/pages/JoinRoomPage.jsx'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage.jsx'));
const StatusPage = lazy(() => import('@/pages/StatusPage.jsx'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage.jsx'));
const OgImagePage = lazy(() => import('@/pages/OgImagePage.jsx'));

const page = (Page) => (
  <Suspense fallback={<FullPageSpinner />}>
    <Page />
  </Suspense>
);

/** "/": the landing page for guests, the play page for logged-in users. */
function RootRoute() {
  const status = useAuthStore((s) => s.status);
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'guest') return page(LandingPage);
  return <AppLayout>{page(HomePage)}</AppLayout>;
}

export default function App() {
  useSocketLifecycle();
  usePlaySession();

  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route element={<ProtectedRoute />}>
        {/* Logged-in pages with the global navbar */}
        <Route element={<AppLayout />}>
          <Route path="/problems" element={page(ProblemsPage)} />
          <Route path="/practice/:slug" element={page(PracticePage)} />
          <Route path="/leaderboard" element={page(LeaderboardPage)} />
          <Route path="/u/:username" element={page(ProfilePage)} />
          <Route path="/matches/:id" element={page(MatchDetailsPage)} />
          <Route path="/join/:code" element={page(JoinRoomPage)} />
          <Route path="/settings" element={page(SettingsPage)} />
        </Route>
        {/* Focus mode: the arena has its own minimal header */}
        <Route path="/match/:id" element={page(MatchPage)} />
      </Route>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={page(LoginPage)} />
        <Route path="/register" element={page(RegisterPage)} />
      </Route>
      <Route path="/dev/status" element={page(StatusPage)} />
      {import.meta.env.DEV && <Route path="/og" element={page(OgImagePage)} />}
      <Route
        path="*"
        element={<div className="flex min-h-dvh flex-col">{page(NotFoundPage)}</div>}
      />
    </Routes>
  );
}
