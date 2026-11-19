import {
  emptySchema,
  matchCodeSchema,
  matchIdSchema,
  rematchSchema,
} from '../../validators/match.schemas.js';

/** In-match events. All business rules live in MatchManager. */
export function registerMatchHandlers({ on, socket, manager, userId }) {
  on('state:get', emptySchema, () => manager.getState(userId));
  on('match:rejoin', matchIdSchema, async ({ matchId }) => {
    const state = await manager.rejoin(userId, matchId);
    socket.emit('match:state', state);
    return state;
  });
  on('match:run', matchCodeSchema, (payload) => manager.run(userId, payload));
  on('match:submit', matchCodeSchema, (payload) => manager.submit(userId, payload));
  on('match:forfeit', emptySchema, () => manager.forfeit(userId));
  on('rematch:request', rematchSchema, (payload) => manager.requestRematch(userId, payload ?? {}));

  // Fire-and-forget typing ping (throttled in the manager).
  socket.on('match:activity', () => manager.activity(userId));
}
