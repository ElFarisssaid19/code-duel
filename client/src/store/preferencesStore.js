import { create } from 'zustand';
import { loadItem, saveItem } from '@/lib/storage.js';

const SOUND_KEY = 'code-duel:sound';

/** Device-level preferences (localStorage). Account preferences live on the user. */
export const usePreferencesStore = create((set) => ({
  soundEnabled: loadItem(SOUND_KEY) !== 'off', // on by default
  toggleSound: () =>
    set((state) => {
      const soundEnabled = !state.soundEnabled;
      saveItem(SOUND_KEY, soundEnabled ? 'on' : 'off');
      return { soundEnabled };
    }),
}));
