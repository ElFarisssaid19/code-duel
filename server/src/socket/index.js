import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { SESSIONS_REVOKED, sessionEvents } from '../lib/sessionEvents.js';
import { judgeSolution, judgeSubmission } from '../services/judge/index.js';
import { MatchManager } from '../services/match/MatchManager.js';
import { createMatchRepository } from '../services/match/matchRepository.js';
import { socketAuth } from './authMiddleware.js';
import { registerMatchHandlers } from './handlers/match.js';
import { registerQueueHandlers } from './handlers/queue.js';
import { registerRoomHandlers } from './handlers/room.js';
import { createOn } from './handlers/util.js';

const userRoom = (userId) => `user:${userId}`;

/**
 * Attaches Socket.io to the HTTP server. Only authenticated users can connect. Every socket
 * joins a per-user room, so events reach all of a user's tabs. Returns the io server; the
 * MatchManager is available as io.matchManager.
 */
export function initSocket(httpServer, { matchConfig, matchmakerOptions } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  const manager = new MatchManager({
    repo: createMatchRepository(),
    judge: { judgeSolution, judgeSubmission },
    notify: (userId, event, payload) => io.to(userRoom(userId)).emit(event, payload),
    config: matchConfig,
    matchmakerOptions,
  });
  io.matchManager = manager;

  io.use(socketAuth);

  // Sessions revoked (password change / log out everywhere): drop sockets that were authenticated
  // with an older token version. The client is told why, then re-checks its session.
  const onSessionsRevoked = async ({ userId, tokenVersion }) => {
    const sockets = await io.in(userRoom(userId)).fetchSockets();
    for (const s of sockets) {
      if (s.data.tokenVersion < tokenVersion) {
        s.emit('session:revoked', { reason: 'Your session was ended on another device.' });
        s.disconnect(true);
      }
    }
  };
  sessionEvents.on(SESSIONS_REVOKED, onSessionsRevoked);
  const closeServer = io.close.bind(io);
  io.close = (...args) => {
    sessionEvents.off(SESSIONS_REVOKED, onSessionsRevoked);
    return closeServer(...args);
  };

  io.on('connection', (socket) => {
    const { user } = socket.data;
    const userId = user.id;
    socket.join(userRoom(userId));
    console.log(`[socket] connected    ${socket.id} (@${user.username})`);

    // Tell the client who the server authenticated this socket as.
    socket.emit('session', { user });

    const context = { on: createOn(socket), socket, manager, userId };
    registerQueueHandlers(context);
    registerRoomHandlers(context);
    registerMatchHandlers(context);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected ${socket.id} (@${user.username}, ${reason})`);
      // Only when the user's last tab is gone.
      if (!io.sockets.adapter.rooms.get(userRoom(userId))?.size) manager.userDisconnected(userId);
    });
  });

  return io;
}
