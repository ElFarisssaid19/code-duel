import { io } from 'socket.io-client';

// Single shared socket. Undefined URL = same origin (proxied to the server by Vite in dev).
// autoConnect is off: call socket.connect() when a screen needs it.
export const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
  autoConnect: false,
  withCredentials: true,
});
