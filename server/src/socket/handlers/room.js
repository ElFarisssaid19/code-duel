import { emptySchema, roomCreateSchema, roomJoinSchema } from '../../validators/match.schemas.js';

/** Private rooms (code / invite link). */
export function registerRoomHandlers({ on, manager, userId }) {
  on('room:create', roomCreateSchema, (payload) => manager.createRoom(userId, payload));
  on('room:join', roomJoinSchema, (payload) => manager.joinRoom(userId, payload));
  on('room:leave', emptySchema, () => manager.leaveRoom(userId));
}
