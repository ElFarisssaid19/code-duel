import { Route, Routes } from 'react-router';
import StatusPage from '@/pages/StatusPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StatusPage />} />
    </Routes>
  );
}
