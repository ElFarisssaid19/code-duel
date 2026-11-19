import { io } from 'socket.io-client';

// Single shared socket. Undefined URL = same origin (proxied to the server by Vite in dev).
// autoConnect is off: useSocketLifecycle connects it only while the user is logged in.
// The server authenticates the handshake with the httpOnly "token" cookie.
export const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
  autoConnect: false,
  withCredentials: true,
});
