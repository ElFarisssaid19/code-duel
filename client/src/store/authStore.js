import { create } from 'zustand';
import { api } from '@/lib/api.js';

/**
 * Session state. The session itself is an httpOnly cookie the browser sends automatically,
 * so the client never sees the token; fetchMe() asks the server who we are.
 *
 * status: 'loading' (before the first fetchMe) | 'authenticated' | 'guest'
 * notice: a message for the login page (e.g. "your session was ended on another device")
 */
export const useAuthStore = create((set) => ({
  user: null,
  status: 'loading',
  notice: null,

  /** Restores the session. /auth/session answers 200 { user: null } for guests (no 401 noise). */
  async fetchMe() {
    try {
      const { user } = await api.get('/auth/session');
      set(user ? { user, status: 'authenticated' } : { user: null, status: 'guest' });
    } catch {
      set({ user: null, status: 'guest' });
    }
  },

  async login(identifier, password) {
    const { user } = await api.post('/auth/login', { identifier, password });
    set({ user, status: 'authenticated', notice: null });
    return user;
  },

  async register({ username, email, password }) {
    const { user } = await api.post('/auth/register', { username, email, password });
    set({ user, status: 'authenticated', notice: null });
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

  /** Revokes every session, including this one. */
  async logoutEverywhere() {
    await api.post('/settings/logout-all');
    set({ user: null, status: 'guest', notice: 'You were logged out of all devices.' });
  },

  /** Other sessions are revoked; this browser receives a fresh cookie and stays logged in. */
  async changePassword({ currentPassword, newPassword }) {
    const { user } = await api.post('/settings/password', { currentPassword, newPassword });
    set({ user });
    return user;
  },

  async updatePreferences(preferences) {
    const { user } = await api.patch('/settings/preferences', preferences);
    set({ user });
    return user;
  },

  /** Dismisses the one-time ghost replay banner (stored on the account, so on every device). */
  async dismissGhostNotice() {
    const { user } = await api.post('/settings/ghost-notice/dismiss');
    set({ user });
    return user;
  },

  setNotice: (notice) => set({ notice }),
}));
