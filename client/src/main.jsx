import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from '@/App.jsx';
import { useAuthStore } from '@/store/authStore.js';
import '@/index.css';

// Restore the session once on app load (the cookie survives page refreshes).
useAuthStore.getState().fetchMe();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
