import bcrypt from 'bcryptjs';
import { HttpError } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { publicUserSelect, toPublicUser } from '../lib/publicUser.js';

const BCRYPT_COST = 12;

// A real cost-12 hash of a random string. Compared against when no user matches, so a login
// attempt takes the same time whether or not the account exists (no user enumeration).
const DUMMY_HASH = '$2b$12$.dZ08Iu/oM2skT6I1cVPVejEKzmFo.umpMdHr7R0jQK7RRnU667rS';

/** Creates a user. A taken username/email surfaces as a Prisma P2002 error (→ 409). */
export async function registerUser({ username, email, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  return prisma.user.create({
    data: { username, email, passwordHash },
    select: publicUserSelect,
  });
}

/** Checks credentials; `identifier` is a username or an email. Returns the public user. */
export async function authenticate({ identifier, password }) {
  // Usernames cannot contain "@", so anything with one is an email.
  const where = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { username: identifier };

  const user = await prisma.user.findUnique({ where });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }
  return toPublicUser(user);
}

/** Resolves a session token to the public user, or null (bad token or deleted user). */
export async function getUserFromToken(token) {
  const userId = await verifyToken(token);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
}
