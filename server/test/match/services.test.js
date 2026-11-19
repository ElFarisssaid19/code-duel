import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateEloChange, expectedScore } from '../../src/services/elo.js';
import { eloWindow, findPairs, Matchmaker } from '../../src/services/match/matchmaker.js';
import { chooseProblem, rankedDifficulties } from '../../src/services/match/problemPicker.js';
import { generateRoomCode, ROOM_CODE_ALPHABET } from '../../src/services/match/roomCodes.js';

describe('elo', () => {
  it('computes the standard expected score', () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(expectedScore(1400, 1000)).toBeCloseTo(0.909, 3);
    expect(expectedScore(1000, 1400) + expectedScore(1400, 1000)).toBeCloseTo(1, 10);
  });

  it.each([
    ['equal ratings, A wins', 1000, 1000, 1, 16],
    ['equal ratings, draw', 1000, 1000, 0.5, 0],
    ['equal ratings, A loses', 1000, 1000, 0, -16],
    ['underdog wins', 1000, 1400, 1, 29],
    ['favourite wins', 1400, 1000, 1, 3],
    ['underdog draws', 1000, 1200, 0.5, 8],
  ])('%s (K = 32)', (_label, a, b, score, expected) => {
    expect(calculateEloChange(a, b, score)).toEqual({ a: expected, b: -expected || 0 });
  });
});

describe('matchmaking', () => {
  afterEach(() => vi.useRealTimers());

  it('widens the ELO window by 50 every 5 s from ±100 to ±500, then anyone after 60 s', () => {
    expect(eloWindow(0)).toBe(100);
    expect(eloWindow(4999)).toBe(100);
    expect(eloWindow(5000)).toBe(150);
    expect(eloWindow(15_000)).toBe(250);
    expect(eloWindow(40_000)).toBe(500);
    expect(eloWindow(59_999)).toBe(500);
    expect(eloWindow(60_000)).toBe(Infinity);
  });

  it('pairs the closest compatible players, oldest first, never a user with themselves', () => {
    const entries = [
      { userId: 1, elo: 1000, joinedAt: 0 },
      { userId: 2, elo: 1090, joinedAt: 0 },
      { userId: 3, elo: 1020, joinedAt: 0 },
      { userId: 4, elo: 2000, joinedAt: 0 },
    ];
    expect(findPairs(entries, 0).map(([a, b]) => [a.userId, b.userId])).toEqual([[1, 3]]);
    expect(
      findPairs(
        [
          { userId: 1, elo: 1000, joinedAt: 0 },
          { userId: 1, elo: 1000, joinedAt: 0 },
        ],
        99_999,
      ),
    ).toEqual([]);
  });

  it('matches two players once the window has widened enough', () => {
    vi.useFakeTimers();
    const onPair = vi.fn();
    const mm = new Matchmaker({ onPair });
    mm.join({ userId: 1, username: 'a', elo: 1000 });
    mm.join({ userId: 2, username: 'b', elo: 1240 }); // 240 apart → needs the 250 window (15 s)
    vi.advanceTimersByTime(14_000);
    expect(onPair).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onPair).toHaveBeenCalledTimes(1);
    expect(mm.has(1) || mm.has(2)).toBe(false);
    mm.shutdown();
  });

  it('pairs anyone after 60 s, and reports status while waiting', () => {
    vi.useFakeTimers();
    const onPair = vi.fn();
    const onStatus = vi.fn();
    const mm = new Matchmaker({ onPair, onStatus });
    mm.join({ userId: 1, username: 'a', elo: 800 });
    vi.advanceTimersByTime(5000);
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 1 }), {
      elapsedMs: 5000,
      window: 150,
    });
    mm.join({ userId: 2, username: 'b', elo: 2400 });
    vi.advanceTimersByTime(54_000);
    expect(onPair).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onPair).toHaveBeenCalledTimes(1);
    mm.shutdown();
  });

  it('leave removes the player', () => {
    vi.useFakeTimers();
    const onPair = vi.fn();
    const mm = new Matchmaker({ onPair });
    mm.join({ userId: 1, username: 'a', elo: 1000 });
    expect(mm.leave(1)).toBe(true);
    mm.join({ userId: 2, username: 'b', elo: 1000 });
    expect(onPair).not.toHaveBeenCalled();
    mm.shutdown();
  });
});

describe('problem picking', () => {
  const candidates = [
    { id: 1, difficulty: 'EASY' },
    { id: 2, difficulty: 'EASY' },
    { id: 3, difficulty: 'MEDIUM' },
  ];

  it('chooses ranked difficulty from average ELO', () => {
    expect(rankedDifficulties(1099)).toEqual(['EASY']);
    expect(rankedDifficulties(1100)).toEqual(['EASY', 'MEDIUM']);
    expect(rankedDifficulties(1299)).toEqual(['EASY', 'MEDIUM']);
    expect(rankedDifficulties(1300)).toEqual(['MEDIUM', 'HARD']);
  });

  it('avoids problems either player saw recently when possible', () => {
    for (let i = 0; i < 20; i++) {
      expect(
        chooseProblem({ candidates, difficulties: ['EASY'], recentIds: new Set([1]) }).id,
      ).toBe(2);
    }
    // All allowed problems are recent: reuse one rather than failing.
    expect(
      chooseProblem({
        candidates,
        difficulties: ['EASY'],
        recentIds: new Set([1, 2]),
        random: () => 0,
      }).id,
    ).toBe(1);
  });

  it('falls back to any difficulty for ranked, but not for strict (private) picks', () => {
    expect(chooseProblem({ candidates, difficulties: ['HARD'] })).not.toBeNull();
    expect(chooseProblem({ candidates, difficulties: ['HARD'], strict: true })).toBeNull();
  });
});

describe('room codes', () => {
  it('are 6 characters from an alphabet without 0/O/1/I', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[0O1I]/);
    for (let i = 0; i < 200; i++) expect(generateRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});
