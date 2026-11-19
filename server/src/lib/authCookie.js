import { env } from '../config/env.js';
import { TOKEN_TTL_SECONDS } from './jwt.js';

export const AUTH_COOKIE_NAME = 'token';

const baseOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  path: '/',
});

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, { ...baseOptions(), maxAge: TOKEN_TTL_SECONDS * 1000 });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, baseOptions());
}
