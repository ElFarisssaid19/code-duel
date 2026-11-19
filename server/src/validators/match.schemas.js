import { z } from 'zod';
import { ROOM_DIFFICULTIES } from '../services/match/problemPicker.js';
import { normalizeRoomCode, ROOM_CODE_PATTERN } from '../services/match/roomCodes.js';
import { practiceSchema } from './practice.schemas.js';

/** Payload-less events: accept nothing or an empty object. */
export const emptySchema = z.object({}).strict().optional();

export const roomCreateSchema = z.object({
  difficulty: z.enum(ROOM_DIFFICULTIES, { error: 'Difficulty must be EASY, MEDIUM, HARD or ANY' }),
});

export const roomJoinSchema = z.object({
  code: z
    .string({ error: 'Room code is required' })
    .transform(normalizeRoomCode)
    .refine((code) => ROOM_CODE_PATTERN.test(code), 'Room codes are 6 letters/digits, e.g. K7M2QX'),
});

export const matchIdSchema = z.object({
  matchId: z.coerce.number({ error: 'matchId is required' }).int().positive(),
});

export const rematchSchema = z
  .object({ matchId: z.coerce.number().int().positive().optional() })
  .optional();

/** Same rules as practice: language enum, code up to 20 KB. */
export const matchCodeSchema = practiceSchema;
