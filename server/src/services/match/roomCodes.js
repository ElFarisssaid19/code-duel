import { randomInt } from 'node:crypto';

/** No 0/O or 1/I, so codes are easy to read out loud and type. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** A random 6-character room code (crypto-random). */
export function generateRoomCode(randomIndex = (max) => randomInt(max)) {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomIndex(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** User input → canonical form (" ab3k9x " → "AB3K9X"). */
export const normalizeRoomCode = (input) =>
  String(input ?? '')
    .trim()
    .toUpperCase();
