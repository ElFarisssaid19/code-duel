import { jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env.js';

const ALGORITHM = 'HS256';
const secret = new TextEncoder().encode(env.JWT_SECRET);

export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** Signs a session token whose subject is the user id. */
export function signToken(userId) {
  return new SignJWT()
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

/** Returns the user id from a valid token, or null if it is missing, invalid or expired. */
export async function verifyToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALGORITHM] });
    const userId = Number(payload.sub);
    return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}
