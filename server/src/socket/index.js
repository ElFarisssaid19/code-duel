import { Server } from 'socket.io';
import { env } from '../config/env.js';

/** Attaches Socket.io to the HTTP server. Game events will be registered here later. */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected    ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected ${socket.id} (${reason})`);
    });
  });

  return io;
}
