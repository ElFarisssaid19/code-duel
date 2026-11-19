import { z } from 'zod';
import { LANGUAGE_IDS } from '../services/judge/languages.js';

export const MAX_CODE_BYTES = 20 * 1024;

export const practiceSchema = z.object({
  language: z.enum(LANGUAGE_IDS, { error: `Language must be one of: ${LANGUAGE_IDS.join(', ')}` }),
  code: z
    .string({ error: 'Code is required' })
    .min(1, 'Code is required')
    .refine(
      (code) => Buffer.byteLength(code, 'utf8') <= MAX_CODE_BYTES,
      'Code must be at most 20 KB',
    ),
});
