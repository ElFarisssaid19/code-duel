import { AUTH_COOKIE_NAME } from '../lib/authCookie.js';
import { unauthorized } from '../lib/errors.js';
import { getUserFromToken } from '../services/auth.service.js';

/** Requires a valid session cookie and sets req.user to the public user fields. */
export async function requireAuth(req, res, next) {
  const user = await getUserFromToken(req.cookies?.[AUTH_COOKIE_NAME]);
  if (!user) throw unauthorized();
  req.user = user;
  next();
}
