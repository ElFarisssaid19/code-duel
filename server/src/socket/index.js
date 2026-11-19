import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { socketAuth } from './authMiddleware.js';

/** Attaches Socket.io to the HTTP server. Only authenticated users can connect. */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    const { user } = socket.data;
    console.log(`[socket] connected    ${socket.id} (@${user.username})`);

    // Tell the client who the server authenticated this socket as.
    socket.emit('session', { user });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected ${socket.id} (@${user.username}, ${reason})`);
    });
  });

  return io;
}
