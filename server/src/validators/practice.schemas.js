import { z } from 'zod';
import { LANGUAGE_IDS } from '../services/judge/languages.js';

export const MAX_CODE_BYTES = 20 * 1024;

const bytes = (s) => Buffer.byteLength(s, 'utf8');

/** ALGO: { language, code }. */
export const practiceSchema = z.object({
  language: z.enum(LANGUAGE_IDS, { error: `Language must be one of: ${LANGUAGE_IDS.join(', ')}` }),
  code: z
    .string({ error: 'Code is required' })
    .min(1, 'Code is required')
    .refine((code) => bytes(code) <= MAX_CODE_BYTES, 'Code must be at most 20 KB'),
});

/** FRONTEND: { html, css } (either may be empty: the track rules decide), 20 KB together. */
export const frontendCodeSchema = z
  .object({
    html: z.string({ error: 'html must be a string' }).default(''),
    css: z.string({ error: 'css must be a string' }).default(''),
  })
  .strict()
  .refine(({ html, css }) => bytes(html) + bytes(css) <= MAX_CODE_BYTES, {
    message: 'HTML + CSS must be at most 20 KB',
    path: ['html'],
  })
  .transform((v) => ({ kind: 'frontend', ...v }));

const isFrontendPayload = (body) =>
  body !== null && typeof body === 'object' && ('html' in body || 'css' in body);

/**
 * Practice/match submissions: { html, css } is a FRONTEND payload (→ { kind: 'frontend', html,
 * css }), anything else is validated as ALGO { language, code } exactly as before.
 */
export const codeSubmissionSchema = {
  parse: (body) =>
    isFrontendPayload(body) ? frontendCodeSchema.parse(body) : practiceSchema.parse(body),
};
