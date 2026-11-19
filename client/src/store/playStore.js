import { create } from 'zustand';

/**
 * What the user is doing outside a match: idle, searching (ranked queue) or hosting a private
 * room. Kept in sync by usePlaySession from server events; the server is the source of truth.
 */
export const usePlayStore = create((set) => ({
  presence: { type: 'idle' }, // from state:get
  queue: null, // { elapsedMs, window } while searching
  room: null, // { code, difficulty, status, players, expiresAt }
  notice: null, // last background error, e.g. match creation failed
  setPresence: (presence) =>
    set({
      presence,
      queue:
        presence.type === 'queue'
          ? { elapsedMs: presence.elapsedMs ?? 0, window: presence.window }
          : null,
      room: presence.type === 'room' ? presence.room : null,
    }),
  setQueue: (queue) => set({ queue, presence: queue ? { type: 'queue' } : { type: 'idle' } }),
  setRoom: (room) => set({ room, presence: room ? { type: 'room', room } : { type: 'idle' } }),
  setNotice: (notice) => set({ notice }),
}));
