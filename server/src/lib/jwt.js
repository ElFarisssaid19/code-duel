import { jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env.js';

const ALGORITHM = 'HS256';
const secret = new TextEncoder().encode(env.JWT_SECRET);

export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Signs a session token: subject = user id, `ver` = the user's tokenVersion (bumping it in the
 * database revokes every token signed with an older version).
 */
export function signToken(userId, tokenVersion = 0) {
  return new SignJWT({ ver: tokenVersion })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

/** { userId, tokenVersion } from a valid token, or null if missing, invalid or expired. */
export async function verifyToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALGORITHM] });
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;
    // Tokens issued before versioning existed carry no `ver`: they count as version 0.
    const tokenVersion = Number.isInteger(payload.ver) ? payload.ver : 0;
    return { userId, tokenVersion };
  } catch {
    return null;
  }
}
