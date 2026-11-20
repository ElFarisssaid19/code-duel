import { EventEmitter } from 'node:events';

/**
 * In-process session events. When a user's tokenVersion is bumped (password change, "log out of
 * all devices"), the socket layer disconnects that user's sockets authenticated with an older
 * version. Decouples the HTTP services from Socket.io.
 */
export const sessionEvents = new EventEmitter();
sessionEvents.setMaxListeners(50);

export const SESSIONS_REVOKED = 'sessions-revoked';

export function emitSessionsRevoked(userId, tokenVersion) {
  sessionEvents.emit(SESSIONS_REVOKED, { userId, tokenVersion });
}
