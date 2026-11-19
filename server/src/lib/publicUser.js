/**
 * The only user fields that may leave the server. Never add passwordHash here.
 * Use `publicUserSelect` in Prisma queries, or `toPublicUser` when the full row was loaded.
 */
export const PUBLIC_USER_FIELDS = [
  'id',
  'username',
  'email',
  'elo',
  'wins',
  'losses',
  'draws',
  'createdAt',
];

export const publicUserSelect = Object.fromEntries(PUBLIC_USER_FIELDS.map((f) => [f, true]));

export function toPublicUser(user) {
  return Object.fromEntries(PUBLIC_USER_FIELDS.map((f) => [f, user[f]]));
}
