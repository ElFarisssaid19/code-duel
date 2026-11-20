/**
 * Game sounds, synthesized with the Web Audio API (no audio files). Browsers only allow audio
 * after a user gesture: unlockAudio() runs on the first click/key press (see main.jsx); before
 * that, sounds are silently skipped. Muting is a preference (store/preferencesStore.js).
 */
import { usePreferencesStore } from '@/store/preferencesStore.js';

let context = null;
let master = null;

function audio() {
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.55;
    master.connect(context.destination);
  }
  return context;
}

/** Creates/resumes the audio context; call from a user gesture. */
export function unlockAudio() {
  const ctx = audio();
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

function tone({ freq, start = 0, duration = 0.15, type = 'sine', gain = 0.16, slideTo }) {
  const ctx = audio();
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

const SOUNDS = {
  /** Rising arpeggio. */
  matchFound: () =>
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone({ freq, start: i * 0.07, duration: 0.25, type: 'triangle' }),
    ),
  /** Countdown 3-2-1. */
  tick: () => tone({ freq: 880, duration: 0.09, type: 'square', gain: 0.07 }),
  /** Countdown "Go!". */
  go: () => {
    tone({ freq: 660, slideTo: 1320, duration: 0.32, type: 'sawtooth', gain: 0.08 });
    tone({ freq: 1320, start: 0.05, duration: 0.3, type: 'triangle', gain: 0.1 });
  },
  /** The opponent passed more tests: subtle double ping. */
  opponentProgress: () => {
    tone({ freq: 740, duration: 0.1, gain: 0.06 });
    tone({ freq: 587, start: 0.1, duration: 0.14, gain: 0.05 });
  },
  /** Victory fanfare (C major). */
  win: () => {
    [523.25, 659.25, 783.99].forEach((freq, i) =>
      tone({ freq, start: i * 0.1, duration: 0.2, type: 'triangle', gain: 0.14 }),
    );
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) =>
      tone({ freq, start: 0.34, duration: 0.7, type: 'triangle', gain: 0.08 }),
    );
  },
  /** Defeat: slow descending minor line. */
  lose: () =>
    [440, 349.23, 293.66].forEach((freq, i) =>
      tone({ freq, start: i * 0.22, duration: 0.4, type: 'sine', gain: 0.1 }),
    ),
  /** Draw: two neutral tones. */
  draw: () =>
    [523.25, 523.25].forEach((freq, i) =>
      tone({ freq, start: i * 0.2, duration: 0.25, type: 'sine', gain: 0.09 }),
    ),
};

/** Plays a named sound unless muted. */
export function playSound(name) {
  if (!usePreferencesStore.getState().soundEnabled) return;
  if (import.meta.env.DEV) (window.__codeDuelSounds ??= []).push(name); // inspected by e2e checks
  try {
    SOUNDS[name]?.();
  } catch {
    // Audio is best-effort.
  }
}
