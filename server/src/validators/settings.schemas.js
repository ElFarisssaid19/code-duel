import { z } from 'zod';
import { LANGUAGE_IDS } from '../services/judge/languages.js';
import { newPassword } from './auth.schemas.js';

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ error: 'Current password is required' })
    .min(1, 'Current password is required'),
  newPassword,
});

export const preferencesSchema = z.object({
  preferredLanguage: z.enum(LANGUAGE_IDS, {
    error: `Language must be one of: ${LANGUAGE_IDS.join(', ')}`,
  }),
});
