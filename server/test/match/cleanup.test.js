import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { createMatchRepository } from '../../src/services/match/matchRepository.js';
import { createProblem } from '../helpers.js';

describe('server-start cleanup (real database)', () => {
  it('cancels WAITING / COUNTDOWN / ACTIVE matches and leaves ended ones alone', async () => {
    const problem = await createProblem(prisma);
    const [u1, u2] = await Promise.all(
      ['p1', 'p2'].map((username) =>
        prisma.user.create({ data: { username, email: `${username}@x.io`, passwordHash: 'x' } }),
      ),
    );
    const base = {
      player1Id: u1.id,
      player2Id: u2.id,
      problemId: problem.id,
      durationMs: 600_000,
      testCount: 5,
      player1Elo: 1000,
      player2Elo: 1000,
    };
    for (const status of ['WAITING', 'COUNTDOWN', 'ACTIVE', 'FINISHED']) {
      await prisma.match.create({
        data: { ...base, status, ...(status === 'FINISHED' && { endReason: 'SOLVED' }) },
      });
    }

    const { count } = await createMatchRepository().cancelStaleMatches();

    expect(count).toBe(3);
    const rows = await prisma.match.findMany({
      orderBy: { id: 'asc' },
      select: { status: true, endReason: true, endedAt: true },
    });
    expect(rows.map((r) => [r.status, r.endReason])).toEqual([
      ['CANCELLED', 'CANCELLED'],
      ['CANCELLED', 'CANCELLED'],
      ['CANCELLED', 'CANCELLED'],
      ['FINISHED', 'SOLVED'],
    ]);
    expect(rows.slice(0, 3).every((r) => r.endedAt instanceof Date)).toBe(true);
  });
});
