import { clearAuthCookie } from '../lib/authCookie.js';
import { changePassword, revokeAllSessions, updatePreferences } from '../services/auth.service.js';
import { startSession } from './auth.controller.js';

/**
 * POST /api/settings/password { currentPassword, newPassword } → 200 { user }.
 * Revokes every session; this browser gets a fresh cookie and stays logged in.
 */
export async function password(req, res) {
  await startSession(res, await changePassword(req.user.id, req.body), 200);
}

/** POST /api/settings/logout-all → 204. Revokes every session, including this one. */
export async function logoutAll(req, res) {
  await revokeAllSessions(req.user.id);
  clearAuthCookie(res);
  res.status(204).end();
}

/** PATCH /api/settings/preferences { preferredLanguage } → 200 { user } */
export async function preferences(req, res) {
  res.json({ user: await updatePreferences(req.user.id, req.body) });
}
