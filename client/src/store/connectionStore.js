import { create } from 'zustand';

/** Socket connection state: 'disconnected' | 'connecting' | 'connected' */
export const useConnectionStore = create((set) => ({
  socketStatus: 'disconnected',
  socketId: null,
  setSocketStatus: (socketStatus, socketId = null) => set({ socketStatus, socketId }),
}));
