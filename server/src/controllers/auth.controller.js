import { clearAuthCookie, setAuthCookie } from '../lib/authCookie.js';
import { signToken } from '../lib/jwt.js';
import { authenticate, registerUser } from '../services/auth.service.js';

async function startSession(res, user, status) {
  setAuthCookie(res, await signToken(user.id));
  res.status(status).json({ user });
}

/** POST /api/auth/register { username, email, password } → 201 { user } + session cookie */
export async function register(req, res) {
  const user = await registerUser(req.body);
  await startSession(res, user, 201);
}

/** POST /api/auth/login { identifier, password } → 200 { user } + session cookie */
export async function login(req, res) {
  const user = await authenticate(req.body);
  await startSession(res, user, 200);
}

/** POST /api/auth/logout → 204, clears the session cookie */
export function logout(req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}

/** GET /api/auth/me → 200 { user } (requireAuth) */
export function me(req, res) {
  res.json({ user: req.user });
}
