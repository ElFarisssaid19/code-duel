import { emptySchema, queueJoinSchema } from '../../validators/match.schemas.js';

/** Ranked matchmaking queue, per category (and optional FRONTEND track). */
export function registerQueueHandlers({ on, manager, userId }) {
  on('queue:join', queueJoinSchema, (options) => manager.joinQueue(userId, options));
  on('queue:leave', emptySchema, () => manager.leaveQueue(userId));
}
