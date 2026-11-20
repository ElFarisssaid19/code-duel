import bcrypt from 'bcryptjs';
import { HttpError } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { publicUserSelect, toPublicUser } from '../lib/publicUser.js';
import { newRatingRows } from '../lib/ratings.js';
import { emitSessionsRevoked } from '../lib/sessionEvents.js';

const BCRYPT_COST = 12;

// A real cost-12 hash of a random string. Compared against when no user matches, so a login
// attempt takes the same time whether or not the account exists (no user enumeration).
const DUMMY_HASH = '$2b$12$.dZ08Iu/oM2skT6I1cVPVejEKzmFo.umpMdHr7R0jQK7RRnU667rS';

const sessionSelect = { ...publicUserSelect, tokenVersion: true };

/** { user (public fields), tokenVersion } from a row selected with sessionSelect. */
function toSession(row) {
  return { user: toPublicUser(row), tokenVersion: row.tokenVersion };
}

/** Creates a user. A taken username/email surfaces as a Prisma P2002 error (→ 409). */
export async function registerUser({ username, email, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const row = await prisma.user.create({
    data: { username, email, passwordHash, ratings: newRatingRows },
    select: sessionSelect,
  });
  return toSession(row);
}

/** Checks credentials; `identifier` is a username or an email. Returns { user, tokenVersion }. */
export async function authenticate({ identifier, password }) {
  // Usernames cannot contain "@", so anything with one is an email.
  const where = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { username: identifier };

  const user = await prisma.user.findUnique({
    where,
    select: { ...sessionSelect, passwordHash: true },
  });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }
  return toSession(user);
}

/**
 * Resolves a session token to { user, tokenVersion }, or null: bad/expired token, deleted user,
 * or a token revoked by a newer tokenVersion.
 */
export async function getSession(token) {
  const claims = await verifyToken(token);
  if (!claims) return null;
  const row = await findSessionRow(claims.userId);
  if (!row || row.tokenVersion !== claims.tokenVersion) return null;
  return toSession(row);
}

/**
 * The user + their rating rows in ONE query (this runs on every authenticated request and
 * socket connection; a Prisma relation load would be a second query).
 */
async function findSessionRow(userId) {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.username, u.email, u.preferredLanguage, u.createdAt, u.tokenVersion,
           r.category, r.elo, r.wins, r.losses, r.draws, r.bestElo
    FROM \`User\` u LEFT JOIN UserRating r ON r.userId = u.id
    WHERE u.id = ${userId}`;
  if (rows.length === 0) return null;
  const ratings = rows
    .filter((r) => r.category)
    .map(({ category, elo, wins, losses, draws, bestElo }) => ({
      category,
      elo,
      wins,
      losses,
      draws,
      bestElo,
    }));
  return { ...rows[0], ratings };
}

/** Bumps tokenVersion: every existing token (and connected socket) of the user is revoked. */
async function bumpTokenVersion(userId, data = {}) {
  const row = await prisma.user.update({
    where: { id: userId },
    data: { ...data, tokenVersion: { increment: 1 } },
    select: sessionSelect,
  });
  emitSessionsRevoked(userId, row.tokenVersion);
  return toSession(row);
}

/**
 * Changes the password (current password required) and revokes all sessions. Returns the new
 * session so the caller can issue a fresh cookie for the current browser.
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const { passwordHash } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!(await bcrypt.compare(currentPassword, passwordHash))) {
    const message = 'Current password is incorrect';
    throw new HttpError(400, 'INVALID_CURRENT_PASSWORD', message, { currentPassword: [message] });
  }
  if (await bcrypt.compare(newPassword, passwordHash)) {
    const message = 'The new password must be different from the current one';
    throw new HttpError(400, 'VALIDATION_ERROR', message, { newPassword: [message] });
  }
  return bumpTokenVersion(userId, { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) });
}

/** "Log out of all devices". */
export const revokeAllSessions = (userId) => bumpTokenVersion(userId);

/** Saves preferences (default editor language). */
export async function updatePreferences(userId, { preferredLanguage }) {
  const row = await prisma.user.update({
    where: { id: userId },
    data: { preferredLanguage },
    select: publicUserSelect,
  });
  return toPublicUser(row);
}
