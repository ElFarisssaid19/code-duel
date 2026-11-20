import { create } from 'zustand';

/**
 * Socket connection state, kept in sync by useSocketLifecycle.
 * socketStatus: 'disconnected' | 'connecting' | 'connected'
 * socketUser:   the user the server authenticated this socket as (from the "session" event)
 * socketError:  last connect_error message, e.g. "Unauthorized: not logged in"
 * everConnected: true once a connection succeeded (the reconnect banner only shows after that)
 */
export const useConnectionStore = create((set) => ({
  socketStatus: 'disconnected',
  socketUser: null,
  socketError: null,
  everConnected: false,
  setSocketState: (patch) => set(patch),
}));
