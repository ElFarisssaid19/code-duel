import http from 'node:http';
import { env } from './config/env.js';
import { app } from './app.js';
import { prisma } from './lib/prisma.js';
import { createMatchRepository } from './services/match/matchRepository.js';
import { initSocket } from './socket/index.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = http.createServer(app);
const io = initSocket(server);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${env.PORT} is already in use. Stop the other process or change PORT.`);
  } else {
    console.error('❌ HTTP server error:', err);
  }
  process.exit(1);
});

// Live match state is in memory only: matches left over from a previous run can't continue.
try {
  const { count } = await createMatchRepository().cancelStaleMatches();
  if (count > 0) console.log(`[match] cancelled ${count} unfinished match(es) from a previous run`);
} catch (err) {
  console.error('[match] could not cancel stale matches:', err.message);
}

server.listen(env.PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    io.matchManager.shutdown(); // stop match timers
    await io.close(); // disconnects all sockets and closes the HTTP server
    await prisma.$disconnect();
    console.log('Shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
