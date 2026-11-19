import { Navigate, Route, Routes } from 'react-router';
import GuestRoute from '@/components/GuestRoute.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import { useSocketLifecycle } from '@/hooks/useSocketLifecycle.js';
import HomePage from '@/pages/HomePage.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import RegisterPage from '@/pages/RegisterPage.jsx';
import StatusPage from '@/pages/StatusPage.jsx';

export default function App() {
  useSocketLifecycle();

  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
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
