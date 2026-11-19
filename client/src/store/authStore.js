import { create } from 'zustand';
import { api } from '@/lib/api.js';

/**
 * Session state. The session itself is an httpOnly cookie the browser sends automatically,
 * so the client never sees the token; fetchMe() asks the server who we are.
 *
 * status: 'loading' (before the first fetchMe) | 'authenticated' | 'guest'
 */
export const useAuthStore = create((set) => ({
  user: null,
  status: 'loading',

  async fetchMe() {
    try {
      const { user } = await api.get('/auth/me');
      set({ user, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'guest' });
    }
  },

  async login(identifier, password) {
    const { user } = await api.post('/auth/login', { identifier, password });
    set({ user, status: 'authenticated' });
    return user;
  },

  async register({ username, email, password }) {
    const { user } = await api.post('/auth/register', { username, email, password });
    set({ user, status: 'authenticated' });
    return user;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      // Even if the request fails, drop the local session so the UI is consistent.
      set({ user: null, status: 'guest' });
    }
  },
}));
