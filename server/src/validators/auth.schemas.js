import { z } from 'zod';

const username = z
  .string({ error: 'Username is required' })
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[A-Za-z0-9_]+$/, 'Username can only contain letters, numbers and underscores');

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address' }).max(255, 'Email is too long'));

const newPassword = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  // bcrypt only uses the first 72 bytes; reject longer passwords instead of silently truncating.
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes');

export const registerSchema = z.object({ username, email, password: newPassword });

export const loginSchema = z.object({
  identifier: z
    .string({ error: 'Username or email is required' })
    .trim()
    .min(1, 'Username or email is required'),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});
