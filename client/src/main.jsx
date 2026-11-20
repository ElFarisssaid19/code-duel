import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from '@/App.jsx';
import { unlockAudio } from '@/lib/sound.js';
import { useAuthStore } from '@/store/authStore.js';
import '@/index.css';

// Restore the session once on app load (the cookie survives page refreshes).
useAuthStore.getState().fetchMe();

// Browsers only allow audio after a user gesture: unlock it on the first one.
for (const event of ['pointerdown', 'keydown']) {
  window.addEventListener(event, unlockAudio, { once: true, capture: true });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
