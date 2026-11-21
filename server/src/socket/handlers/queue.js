import { emptySchema, queueJoinSchema } from '../../validators/match.schemas.js';

/** Ranked matchmaking queue, per category (and optional FRONTEND track), and ghost matches. */
export function registerQueueHandlers({ on, manager, userId }) {
  on('queue:join', queueJoinSchema, (options) => manager.joinQueue(userId, options));
  on('queue:leave', emptySchema, () => manager.leaveQueue(userId));
  // Replay of a past ranked run (or a bot); also accepted while queueing ("Play a ghost now").
  on('ghost:start', queueJoinSchema, (options) => manager.startGhost(userId, options));
}
