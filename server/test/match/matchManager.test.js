import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchManager } from '../../src/services/match/MatchManager.js';
import { HIDDEN_SENTINELS } from '../helpers.js';
import { createFakeJudge, createFakeRepo, createRecorder, makeProblem } from './fakes.js';

const A = 1;
const B = 2;
const C = 3;
const MINUTE = 60_000;

let repo;
let judge;
let recorder;
let manager;

function setup({ users, problems } = {}) {
  repo = createFakeRepo({
    users: users ?? [
      { id: A, username: 'alice', elo: 1000 },
      { id: B, username: 'bob', elo: 1000 },
      { id: C, username: 'carol', elo: 1000 },
    ],
    problems,
  });
  judge = createFakeJudge();
  recorder = createRecorder();
  manager = new MatchManager({ repo, judge, notify: recorder.notify });
}

beforeEach(() => {
  vi.useFakeTimers();
  setup();
});

afterEach(() => {
  manager.shutdown();
  vi.useRealTimers();
});

const flush = () => vi.advanceTimersByTimeAsync(0);

/** Both players queue → matched → both clients join → countdown → ACTIVE. Returns the matchId. */
async function startRanked(p1 = A, p2 = B) {
  await manager.joinQueue(p1);
  await manager.joinQueue(p2);
  await flush();
  const { matchId } = recorder.last(p1, 'match:found');
  await manager.rejoin(p1, matchId);
  await manager.rejoin(p2, matchId);
  await vi.advanceTimersByTimeAsync(3000);
  expect(recorder.last(p1, 'match:start')).toBeDefined();
  return matchId;
}

async function startPrivate(host = A, guest = B, difficulty = 'ANY') {
  const room = await manager.createRoom(host, { difficulty });
  const { matchId } = await manager.joinRoom(guest, { code: room.code });
  await manager.rejoin(host, matchId);
  await manager.rejoin(guest, matchId);
  await vi.advanceTimersByTimeAsync(3000);
  return matchId;
}

const submit = (userId, code) => manager.submit(userId, { language: 'javascript', code });
const endOf = (userId) => recorder.last(userId, 'match:end');

describe('match lifecycle', () => {
  it('goes WAITING → COUNTDOWN (3 s) → ACTIVE with the problem revealed at start', async () => {
    await manager.joinQueue(A);
    await manager.joinQueue(B);
    await flush();
    const { matchId } = recorder.last(A, 'match:found');
    expect(recorder.last(B, 'match:found')).toEqual({ matchId, mode: 'RANKED' });
    expect(repo.matches.get(matchId).status).toBe('WAITING');

    const waiting = await manager.rejoin(A, matchId);
    expect(waiting).toMatchObject({ status: 'WAITING', problem: null });
    await manager.rejoin(B, matchId);
    expect(recorder.last(A, 'match:countdown').startsAt).toBe(Date.now() + 3000);
    expect(repo.matches.get(matchId).status).toBe('COUNTDOWN');

    await vi.advanceTimersByTimeAsync(2999);
    expect(recorder.last(A, 'match:start')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);

    const start = recorder.last(A, 'match:start');
    expect(start.endsAt).toBe(Date.now() + 10 * MINUTE); // EASY = 10 minutes
    expect(start.opponent).toMatchObject({ username: 'bob', elo: 1000 });
    expect(start.problem.samples).toHaveLength(2);
    expect(repo.matches.get(matchId)).toMatchObject({
      status: 'ACTIVE',
      durationMs: 10 * MINUTE,
      testCount: 5,
    });
  });

  it('uses 15 / 20 minutes for MEDIUM / HARD problems', async () => {
    setup({ problems: [makeProblem({ id: 7, difficulty: 'HARD' })] });
    await startPrivate(A, B, 'HARD');
    expect(recorder.last(A, 'match:start').endsAt).toBe(Date.now() + 20 * MINUTE);
  });

  it('cancels a match when a player never connects', async () => {
    await manager.joinQueue(A);
    await manager.joinQueue(B);
    await flush();
    const { matchId } = recorder.last(A, 'match:found');
    await manager.rejoin(A, matchId);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(endOf(A)).toMatchObject({ reason: 'CANCELLED', winnerId: null, eloChanges: null });
    expect(repo.matches.get(matchId)).toMatchObject({
      status: 'CANCELLED',
      endReason: 'CANCELLED',
    });
    expect(manager.getState(A)).toEqual({ type: 'idle' });
  });
});

describe('winning', () => {
  it('the first player to pass all tests wins immediately (SOLVED) and ELO is updated', async () => {
    const matchId = await startRanked();
    await submit(A, 'pass:2');
    expect(recorder.last(B, 'opponent:progress')).toEqual({
      userId: A,
      passed: 2,
      total: 5,
      attempts: 1,
    });

    await vi.advanceTimersByTimeAsync(3000);
    await submit(B, 'solve');

    expect(endOf(A)).toMatchObject({
      winnerId: B,
      reason: 'SOLVED',
      eloChanges: {
        [A]: { before: 1000, after: 984, delta: -16 },
        [B]: { before: 1000, after: 1016, delta: 16 },
      },
    });
    expect(endOf(A).summary.players.find((p) => p.userId === B)).toMatchObject({
      passed: 5,
      attempts: 1,
      result: 'win',
      solveTimeMs: 3000,
    });
    expect(repo.finishMatch).toHaveBeenCalledTimes(1);
    expect(repo.users.get(A)).toMatchObject({ elo: 984, losses: 1 });
    expect(repo.users.get(B)).toMatchObject({ elo: 1016, wins: 1 });
    expect(repo.matches.get(matchId)).toMatchObject({
      status: 'FINISHED',
      endReason: 'SOLVED',
      winnerId: B,
      player1EloChange: -16,
      player2EloChange: 16,
    });
    expect(manager.getState(A)).toEqual({ type: 'idle' });
  });

  it('only one winner when both solve at the same time', async () => {
    await startRanked();
    await Promise.all([submit(A, 'solve'), submit(B, 'solve')]);
    expect(recorder.of(A, 'match:end')).toHaveLength(1);
    expect(repo.finishMatch).toHaveBeenCalledTimes(1);
  });

  it('on timeout, the player with the most tests passed wins', async () => {
    await startRanked();
    await submit(A, 'pass:3');
    await submit(B, 'pass:1');
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(endOf(B)).toMatchObject({ winnerId: A, reason: 'TIMEOUT' });
  });

  it('on timeout with equal counts, whoever reached that count first wins', async () => {
    await startRanked();
    await vi.advanceTimersByTimeAsync(60_000);
    await submit(B, 'pass:2'); // B reaches 2 first
    await vi.advanceTimersByTimeAsync(60_000);
    await submit(A, 'pass:2');
    await vi.advanceTimersByTimeAsync(3000);
    await submit(B, 'pass:1'); // a worse later submission doesn't lower the best
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(endOf(A)).toMatchObject({ winnerId: B, reason: 'TIMEOUT' });
  });

  it('on timeout with 0 tests each, it is a draw', async () => {
    await startRanked();
    await submit(A, 'fail');
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(endOf(A)).toMatchObject({
      winnerId: null,
      reason: 'TIMEOUT',
      eloChanges: { [A]: { delta: 0 }, [B]: { delta: 0 } },
    });
    expect(repo.users.get(A).draws).toBe(1);
    expect(repo.users.get(B).draws).toBe(1);
  });

  it('forfeit gives the win to the other player', async () => {
    await startRanked();
    await manager.forfeit(A);
    expect(endOf(B)).toMatchObject({ winnerId: B, reason: 'FORFEIT' });
    expect(repo.users.get(B).wins).toBe(1);
  });
});

describe('disconnects', () => {
  it('keeps the match running during the 30 s grace period and resumes on rejoin', async () => {
    const matchId = await startRanked();
    manager.userDisconnected(A);
    expect(recorder.last(B, 'opponent:connection')).toEqual({
      connected: false,
      graceEndsAt: Date.now() + 30_000,
    });

    await vi.advanceTimersByTimeAsync(20_000);
    const state = await manager.rejoin(A, matchId);
    expect(recorder.last(B, 'opponent:connection')).toEqual({ connected: true });
    expect(state).toMatchObject({ status: 'ACTIVE', remainingMs: 10 * MINUTE - 20_000 });

    await vi.advanceTimersByTimeAsync(20_000); // past the original 30 s
    expect(endOf(A)).toBeUndefined();
  });

  it('the opponent wins after 30 s offline (DISCONNECT)', async () => {
    await startRanked();
    manager.userDisconnected(A);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(endOf(B)).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(endOf(B)).toMatchObject({ winnerId: B, reason: 'DISCONNECT' });
  });

  it('leaving the queue on disconnect', async () => {
    await manager.joinQueue(A);
    manager.userDisconnected(A);
    expect(manager.getState(A)).toEqual({ type: 'idle' });
    await manager.joinQueue(B);
    await vi.advanceTimersByTimeAsync(5000);
    expect(recorder.last(B, 'match:found')).toBeUndefined();
  });
});

describe('one activity per user', () => {
  it("a user can't join a queue, room or second match while in a match", async () => {
    await startRanked();
    await expect(manager.joinQueue(A)).rejects.toMatchObject({ code: 'ALREADY_BUSY' });
    await expect(manager.createRoom(A, { difficulty: 'ANY' })).rejects.toMatchObject({
      code: 'ALREADY_BUSY',
    });
    const room = await manager.createRoom(C, { difficulty: 'ANY' });
    await expect(manager.joinRoom(A, { code: room.code })).rejects.toMatchObject({
      code: 'ALREADY_BUSY',
    });
  });

  it("can't queue twice or open a room while searching", async () => {
    await manager.joinQueue(A);
    await expect(manager.joinQueue(A)).rejects.toMatchObject({ code: 'ALREADY_BUSY' });
    await expect(manager.createRoom(A, { difficulty: 'ANY' })).rejects.toMatchObject({
      code: 'ALREADY_BUSY',
    });
    expect(manager.leaveQueue(A)).toEqual({ status: 'idle' });
    await expect(manager.createRoom(A, { difficulty: 'ANY' })).resolves.toMatchObject({
      status: 'open',
    });
  });

  it("a user can't play against themselves", async () => {
    const room = await manager.createRoom(A, { difficulty: 'ANY' });
    await expect(manager.joinRoom(A, { code: room.code })).rejects.toMatchObject({
      code: 'CANNOT_PLAY_YOURSELF',
    });
    await manager.leaveRoom(A);
    await manager.joinQueue(A);
    await vi.advanceTimersByTimeAsync(70_000); // even after the "anyone" threshold
    expect(recorder.last(A, 'match:found')).toBeUndefined();
  });
});

describe('private rooms', () => {
  it('are joined by code (case-insensitive) and never change ELO', async () => {
    const room = await manager.createRoom(A, { difficulty: 'EASY' });
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(recorder.last(A, 'room:update')).toMatchObject({
      code: room.code,
      status: 'open',
      difficulty: 'EASY',
    });

    const { matchId } = await manager.joinRoom(B, { code: room.code.toLowerCase() });
    expect(recorder.last(A, 'room:update')).toMatchObject({
      status: 'starting',
      players: [{ username: 'alice' }, { username: 'bob' }],
    });
    expect(recorder.last(A, 'match:found')).toEqual({ matchId, mode: 'PRIVATE' });
    await manager.rejoin(A, matchId);
    await manager.rejoin(B, matchId);
    await vi.advanceTimersByTimeAsync(3000);
    await submit(B, 'solve');

    expect(endOf(A)).toMatchObject({
      mode: 'PRIVATE',
      winnerId: B,
      reason: 'SOLVED',
      eloChanges: null,
    });
    expect(repo.finishMatch.mock.calls[0][2]).toEqual([]); // no user stat updates
    expect(repo.users.get(A)).toMatchObject({ elo: 1000, wins: 0, losses: 0 });
    expect(repo.users.get(B)).toMatchObject({ elo: 1000, wins: 0, losses: 0 });
    expect(repo.matches.get(matchId)).toMatchObject({
      mode: 'PRIVATE',
      roomCode: room.code,
      player1EloChange: null,
    });
  });

  it('expire after 10 minutes without a second player', async () => {
    const room = await manager.createRoom(A, { difficulty: 'ANY' });
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(recorder.last(A, 'room:update')).toMatchObject({
      code: room.code,
      status: 'closed',
      reason: 'EXPIRED',
    });
    expect(manager.getState(A)).toEqual({ type: 'idle' });
    await expect(manager.joinRoom(B, { code: room.code })).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    });
  });

  it('reject a difficulty with no problems', async () => {
    await expect(manager.createRoom(A, { difficulty: 'HARD' })).rejects.toMatchObject({
      code: 'NO_PROBLEMS',
    });
    expect(manager.getState(A)).toEqual({ type: 'idle' });
  });

  it('offer a rematch that starts once both players accept', async () => {
    const first = await startPrivate();
    await manager.forfeit(A);

    await manager.requestRematch(A, {});
    expect(recorder.last(B, 'rematch:update')).toEqual({
      matchId: first,
      status: 'pending',
      requestedBy: [A],
    });
    const accepted = await manager.requestRematch(B, { matchId: first });
    expect(accepted.status).toBe('accepted');
    expect(recorder.last(A, 'match:found')).toEqual({
      matchId: accepted.newMatchId,
      mode: 'PRIVATE',
    });
    expect(accepted.newMatchId).not.toBe(first);
  });

  it('have no rematch for ranked matches', async () => {
    await startRanked();
    await manager.forfeit(A);
    await expect(manager.requestRematch(A, {})).rejects.toMatchObject({
      code: 'REMATCH_UNAVAILABLE',
    });
  });
});

describe('in-match actions', () => {
  it('run only judges the samples and does not change progress', async () => {
    await startRanked();
    const { result } = await manager.run(A, { language: 'python', code: 'solve' });
    expect(result).toMatchObject({ mode: 'run', status: 'ACCEPTED', passed: 2, total: 2 });
    expect(judge.judgeSolution.mock.calls[0][0].tests.every((t) => !t.hidden)).toBe(true);
    expect(recorder.of(B, 'opponent:progress')).toHaveLength(0);
  });

  it('rate-limits run + submit to 1 per 3 seconds per player', async () => {
    await startRanked();
    await manager.run(A, { language: 'javascript', code: 'fail' });
    await expect(submit(A, 'solve')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await submit(B, 'pass:1'); // the other player isn't affected
    await vi.advanceTimersByTimeAsync(3000);
    await expect(submit(A, 'pass:1')).resolves.toBeDefined();
  });

  it('saves every submission with the matchId', async () => {
    const matchId = await startRanked();
    await submit(A, 'pass:1');
    expect(repo.submissions).toEqual([
      expect.objectContaining({
        matchId,
        userId: A,
        problemId: 1,
        language: 'javascript',
        status: 'WRONG_ANSWER',
        passed: 1,
        total: 5,
      }),
    ]);
  });

  it('throttles typing pings', async () => {
    await startRanked();
    manager.activity(A);
    manager.activity(A);
    expect(recorder.of(B, 'opponent:activity')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    manager.activity(A);
    expect(recorder.of(B, 'opponent:activity')).toHaveLength(2);
  });

  it('rejects actions outside an active match', async () => {
    await expect(submit(A, 'solve')).rejects.toMatchObject({ code: 'MATCH_NOT_ACTIVE' });
    await expect(manager.forfeit(A)).rejects.toMatchObject({ code: 'NOT_IN_MATCH' });
    const matchId = await startRanked();
    await expect(manager.rejoin(C, matchId)).rejects.toMatchObject({ code: 'MATCH_NOT_FOUND' });
  });
});

it('never puts hidden test data in any event', async () => {
  await startRanked();
  await manager.run(A, { language: 'javascript', code: 'pass:1' });
  await vi.advanceTimersByTimeAsync(3000);
  await submit(A, 'pass:3');
  await submit(B, 'solve');
  const raw = JSON.stringify(recorder.events);
  for (const value of Object.values(HIDDEN_SENTINELS)) expect(raw).not.toContain(String(value));
});
