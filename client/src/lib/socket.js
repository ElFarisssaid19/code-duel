import { io } from 'socket.io-client';

// Single shared socket. Undefined URL = same origin (proxied to the server by Vite in dev).
// autoConnect is off: useSocketLifecycle connects it only while the user is logged in.
// The server authenticates the handshake with the httpOnly "token" cookie.
export const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
  autoConnect: false,
  withCredentials: true,
});

/** Error from a socket request: same { code, message } as the server's error shape. */
export class SocketRequestError extends Error {
  constructor({ code, message }) {
    super(message);
    this.name = 'SocketRequestError';
    this.code = code;
    // ResultsPanel styles 429s differently.
    this.status = code === 'RATE_LIMITED' ? 429 : 0;
  }
}

/**
 * Request/response over the socket (acknowledgements). Resolves with the server's data or
 * rejects with a SocketRequestError. Emits are buffered while (re)connecting.
 */
export async function request(event, payload, timeoutMs = 20_000) {
  let res;
  try {
    res =
      payload === undefined
        ? await socket.timeout(timeoutMs).emitWithAck(event)
        : await socket.timeout(timeoutMs).emitWithAck(event, payload);
  } catch {
    throw new SocketRequestError({
      code: 'TIMEOUT',
      message: 'The server did not respond. Check your connection.',
    });
  }
  if (!res?.ok)
    throw new SocketRequestError(res?.error ?? { code: 'UNKNOWN', message: 'Request failed' });
  return res.data;
}
