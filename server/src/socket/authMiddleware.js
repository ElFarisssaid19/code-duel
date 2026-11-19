import { parseCookie } from 'cookie';
import { AUTH_COOKIE_NAME } from '../lib/authCookie.js';
import { getUserFromToken } from '../services/auth.service.js';

function unauthorizedError(message) {
  const err = new Error(message);
  err.data = { code: 'UNAUTHORIZED', message }; // sent to the client with connect_error
  return err;
}

/** Socket.io middleware: authenticates the handshake with the session cookie. */
export async function socketAuth(socket, next) {
  try {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
    const token = cookies[AUTH_COOKIE_NAME];
    if (!token) return next(unauthorizedError('Unauthorized: not logged in'));

    const user = await getUserFromToken(token);
    if (!user) return next(unauthorizedError('Unauthorized: invalid or expired session'));

    socket.data.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
