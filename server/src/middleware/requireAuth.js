import { AUTH_COOKIE_NAME } from '../lib/authCookie.js';
import { unauthorized } from '../lib/errors.js';
import { getSession } from '../services/auth.service.js';

/**
 * Requires a valid, non-revoked session cookie. Sets req.user (public fields) and
 * req.tokenVersion.
 */
export async function requireAuth(req, res, next) {
  const session = await getSession(req.cookies?.[AUTH_COOKIE_NAME]);
  if (!session) throw unauthorized();
  req.user = session.user;
  req.tokenVersion = session.tokenVersion;
  next();
}
