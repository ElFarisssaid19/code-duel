import { clearAuthCookie, setAuthCookie } from '../lib/authCookie.js';
import { signToken } from '../lib/jwt.js';
import { AUTH_COOKIE_NAME } from '../lib/authCookie.js';
import { authenticate, getSession, registerUser } from '../services/auth.service.js';

/** Sets a session cookie for { user, tokenVersion } and answers { user }. */
export async function startSession(res, { user, tokenVersion }, status = 200) {
  setAuthCookie(res, await signToken(user.id, tokenVersion));
  res.status(status).json({ user });
}

/** POST /api/auth/register { username, email, password } → 201 { user } + session cookie */
export async function register(req, res) {
  await startSession(res, await registerUser(req.body), 201);
}

/** POST /api/auth/login { identifier, password } → 200 { user } + session cookie */
export async function login(req, res) {
  await startSession(res, await authenticate(req.body), 200);
}

/** POST /api/auth/logout → 204, clears the session cookie (other sessions stay valid) */
export function logout(req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}

/**
 * GET /api/auth/session → 200 { user } or 200 { user: null }. Never 401: used by the client to
 * restore the session on page load, where "logged out" is a normal state, not an error.
 */
export async function session(req, res) {
  const current = await getSession(req.cookies?.[AUTH_COOKIE_NAME]);
  res.json({ user: current?.user ?? null });
}

/** GET /api/auth/me → 200 { user } (requireAuth) */
export function me(req, res) {
  res.json({ user: req.user });
}
