/**
 * The Phase 6 migration (20261121090000_frontend_category) moves every user's ELO and W/L/D into
 * their ALGO UserRating row and gives everyone a FRONTEND row at 1000. Tested on a scratch
 * database: older migrations → users with real stats → the Phase 6 migration.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { prisma } from '../src/lib/prisma.js';

const PHASE6 = '20261121090000_frontend_category';
const MIGRATIONS = new URL('../prisma/migrations/', import.meta.url);
const SCRATCH_DB = 'code_duel_test_migration';

/** Statements of a migration file (they never contain ";" inside, only at line ends). */
const statements = (name) =>
  readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS), 'utf8')
    .split(/;\s*\n/)
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);

let db;

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
  await prisma.$executeRawUnsafe(`CREATE DATABASE ${SCRATCH_DB}`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${SCRATCH_DB}`;
  db = new PrismaClient({ adapter: new PrismaMariaDb(url.toString()) });

  const older = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name < PHASE6)
    .map((d) => d.name)
    .sort();
  for (const name of older) for (const sql of statements(name)) await db.$executeRawUnsafe(sql);
}, 60_000);

afterAll(async () => {
  await db?.$disconnect();
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
});

describe('migration 20261121090000_frontend_category', () => {
  it('existing users keep their ELO and stats as ALGO; FRONTEND starts at 1000', async () => {
    // Before Phase 6: ratings live on User.
    await db.$executeRawUnsafe(`
      INSERT INTO User (id, username, email, passwordHash, elo, wins, losses, draws) VALUES
        (1, 'veteran', 'v@x.io', 'x', 1240, 12, 4, 1),
        (2, 'fallen', 'f@x.io', 'x', 960, 2, 5, 0),
        (3, 'newbie', 'n@x.io', 'x', 1000, 0, 0, 0)`);
    await db.$executeRawUnsafe(`
      INSERT INTO Problem (id, title, slug, description, difficulty, starterCode, functionName)
      VALUES (1, 'P', 'p', 'x', 'EASY', '{}', '{}')`);
    // "fallen" peaked at 1080 after a ranked match before dropping to 960.
    await db.$executeRawUnsafe(`
      INSERT INTO \`Match\` (mode, status, player1Id, player2Id, problemId, durationMs, testCount,
                             player1Elo, player2Elo, player1EloChange, player2EloChange, endedAt)
      VALUES ('RANKED', 'FINISHED', 2, 1, 1, 600000, 5, 1064, 1256, 16, -16, NOW())`);

    for (const sql of statements(PHASE6)) await db.$executeRawUnsafe(sql);

    const rows = await db.$queryRawUnsafe(
      'SELECT userId, category, elo, wins, losses, draws, bestElo FROM UserRating ORDER BY userId, category',
    );
    expect(rows).toEqual([
      // bestElo = max(1000, current, every post-match ELO): veteran's 1256 was a pre-match value.
      { userId: 1, category: 'ALGO', elo: 1240, wins: 12, losses: 4, draws: 1, bestElo: 1240 },
      { userId: 1, category: 'FRONTEND', elo: 1000, wins: 0, losses: 0, draws: 0, bestElo: 1000 },
      { userId: 2, category: 'ALGO', elo: 960, wins: 2, losses: 5, draws: 0, bestElo: 1080 },
      { userId: 2, category: 'FRONTEND', elo: 1000, wins: 0, losses: 0, draws: 0, bestElo: 1000 },
      { userId: 3, category: 'ALGO', elo: 1000, wins: 0, losses: 0, draws: 0, bestElo: 1000 },
      { userId: 3, category: 'FRONTEND', elo: 1000, wins: 0, losses: 0, draws: 0, bestElo: 1000 },
    ]);

    // The old columns are gone; existing matches are ALGO.
    const columns = await db.$queryRawUnsafe(
      `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = '${SCRATCH_DB}' AND TABLE_NAME = 'User' AND COLUMN_NAME IN ('elo','wins','losses','draws')`,
    );
    expect(columns).toEqual([]);
    const [match] = await db.$queryRawUnsafe('SELECT category FROM `Match`');
    expect(match.category).toBe('ALGO');
  });
});
