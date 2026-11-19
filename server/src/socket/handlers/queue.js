import { emptySchema } from '../../validators/match.schemas.js';

/** Ranked matchmaking queue. */
export function registerQueueHandlers({ on, manager, userId }) {
  on('queue:join', emptySchema, () => manager.joinQueue(userId));
  on('queue:leave', emptySchema, () => manager.leaveQueue(userId));
}
