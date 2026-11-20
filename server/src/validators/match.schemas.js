import { z } from 'zod';
import { ROOM_DIFFICULTIES } from '../services/match/problemPicker.js';
import { normalizeRoomCode, ROOM_CODE_PATTERN } from '../services/match/roomCodes.js';
import { codeSubmissionSchema } from './practice.schemas.js';
import { categorySchema, trackSchema } from './query.schemas.js';

/** Payload-less events: accept nothing or an empty object. */
export const emptySchema = z.object({}).strict().optional();

/** { category?, track? }: ALGO by default; a track (FRONTEND only) narrows the problems. */
const categoryOptions = {
  category: categorySchema.default('ALGO'),
  track: trackSchema.nullish().transform((t) => t ?? null),
};
const trackOnlyForFrontend = [
  (v) => v.category === 'FRONTEND' || v.track === null,
  { message: 'A track can only be chosen for FRONTEND', path: ['track'] },
];

/** queue:join: nothing (ALGO) or { category, track? }. */
export const queueJoinSchema = z
  .object(categoryOptions)
  .strict()
  .refine(...trackOnlyForFrontend)
  .optional()
  .transform((v) => v ?? { category: 'ALGO', track: null });

export const roomCreateSchema = z
  .object({
    difficulty: z.enum(ROOM_DIFFICULTIES, {
      error: 'Difficulty must be EASY, MEDIUM, HARD or ANY',
    }),
    ...categoryOptions,
  })
  .refine(...trackOnlyForFrontend);

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

/** Same rules as practice: ALGO { language, code } or FRONTEND { html, css }, up to 20 KB. */
export const matchCodeSchema = codeSubmissionSchema;
