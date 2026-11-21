/**
 * Ghost and bot matches (fake repo, fake judge, fake timers): replay timing, who wins, timeout
 * comparison, K=16 for the human only, bot fallback, the queue offer, and payloads that always
 * flag the ghost/bot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateEloChange } from '../../src/services/elo.js';
import {
  botTimeline,
  BOTS,
  GHOST_PLAYER_ID,
  ghostTimeline,
  pickBot,
  selectGhostRun,
} from '../../src/services/match/ghosts.js';
import { MatchManager } from '../../src/services/match/MatchManager.js';
import { createFakeJudge, createFakeRepo, createRecorder } from './fakes.js';

const A = 1;
const B = 2;
const GHOST_USER = 7;
const SECOND = 1000;
const EASY_MS = 10 * 60_000;
const T0 = new Date('2026-11-01T10:00:00Z');
const at = (seconds) => new Date(T0.getTime() + seconds * SECOND);

const run = (overrides = {}) => ({
  matchId: 900,
  problemId: 1,
  userId: GHOST_USER,
  username: 'ghosty',
  elo: 1050,
  solved: true,
  startedAt: T0,
  endedAt: at(130),
  ...overrides,
});

let repo;
let recorder;
let manager;

/** Seeded random so bot timelines are deterministic. */
function seeded(seed = 42) {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

function setup({ ghostRuns = [run()], runSubmissions, random } = {}) {
  repo = createFakeRepo({
    users: [
      { id: A, username: 'alice', elo: 1000 },
      { id: B, username: 'bob', elo: 1000 },
    ],
    ghostRuns,
    runSubmissions: runSubmissions ?? {
      '900:7': [
        { createdAt: at(60), status: 'WRONG_ANSWER', passed: 2, total: 5 },
        { createdAt: at(120), status: 'ACCEPTED', passed: 5, total: 5 },
      ],
    },
  });
  recorder = createRecorder();
  manager = new MatchManager({
    repo,
    judge: createFakeJudge(),
    notify: recorder.notify,
    random: random ?? seeded(),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setup();
});
afterEach(() => {
  manager.shutdown();
  vi.useRealTimers();
});

const endOf = () => recorder.last(A, 'match:end');
const submit = (code) => manager.submit(A, { language: 'javascript', code });

/** Starts a ghost match for A and plays the countdown. Returns { matchId, ack }. */
async function startGhost(options) {
  const ack = await manager.startGhost(A, options);
  await manager.rejoin(A, ack.matchId);
  await vi.advanceTimersByTimeAsync(3000); // countdown
  return { matchId: ack.matchId, ack };
}

describe('ghost replay', () => {
  it('replays the recorded run at the recorded times, then the ghost wins when it solves first', async () => {
    const { matchId, ack } = await startGhost();
    expect(ack).toMatchObject({
      mode: 'GHOST',
      ghost: { kind: 'ghost', username: 'ghosty', rating: 1050, replayOf: at(130).toISOString() },
    });
    expect(recorder.last(A, 'match:found')).toEqual({ matchId, mode: 'GHOST' });

    await vi.advanceTimersByTimeAsync(59 * SECOND);
    expect(recorder.of(A, 'opponent:progress')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1 * SECOND);
    expect(recorder.last(A, 'opponent:progress')).toEqual({
      userId: GHOST_PLAYER_ID,
      passed: 2,
      total: 5,
      attempts: 1,
    });

    await vi.advanceTimersByTimeAsync(60 * SECOND); // 120 s: the ghost's accepted submission
    const delta = calculateEloChange(1000, 1050, 0, 16).a;
    expect(endOf()).toMatchObject({
      mode: 'GHOST',
      winnerId: GHOST_PLAYER_ID,
      reason: 'SOLVED',
      eloChanges: { [A]: { before: 1000, after: 1000 + delta, delta } },
    });
    expect(Object.keys(endOf().eloChanges)).toEqual([String(A)]); // only the human
    expect(endOf().summary.players[1]).toMatchObject({
      userId: GHOST_PLAYER_ID,
      result: 'win',
      ghost: { kind: 'ghost', username: 'ghosty' },
    });

    // K=16, only the human's rating; the ghost's real account is never touched.
    const [, data, statUpdates] = repo.finishMatch.mock.calls[0];
    expect(statUpdates).toEqual([{ userId: A, category: 'ALGO', eloDelta: delta, result: 'loss' }]);
    expect(delta).toBe(-7);
    expect(data).toMatchObject({ winnerId: null, winnerIsGhost: true, player2EloChange: null });
    expect(repo.matches.get(matchId)).toMatchObject({
      mode: 'GHOST',
      player2Id: null,
      player2Elo: 1050,
      ghostUserId: GHOST_USER,
      ghostSourceMatchId: 900,
      botId: null,
    });
    expect(repo.users.get(A).losses).toBe(1);
  });

  it('the human wins when faster; the rest of the replay is cancelled', async () => {
    await startGhost();
    await vi.advanceTimersByTimeAsync(30 * SECOND);
    await submit('solve');
    const delta = calculateEloChange(1000, 1050, 1, 16).a;
    expect(endOf()).toMatchObject({ winnerId: A, reason: 'SOLVED' });
    expect(endOf().eloChanges[A].delta).toBe(delta);
    expect(delta).toBe(9);
    await vi.advanceTimersByTimeAsync(EASY_MS);
    expect(recorder.of(A, 'opponent:progress')).toHaveLength(0);
    expect(recorder.of(A, 'match:end')).toHaveLength(1);
  });

  it('timeout: compared with the ghost final progress (more tests, then who got there first)', async () => {
    const unsolved = {
      '900:7': [{ createdAt: at(60), status: 'WRONG_ANSWER', passed: 3, total: 5 }],
    };
    setup({ ghostRuns: [run({ solved: false })], runSubmissions: unsolved });
    await startGhost();
    await vi.advanceTimersByTimeAsync(100 * SECOND);
    await submit('pass:4');
    await vi.advanceTimersByTimeAsync(EASY_MS);
    expect(endOf()).toMatchObject({ winnerId: A, reason: 'TIMEOUT' });

    manager.shutdown();
    setup({ ghostRuns: [run({ solved: false })], runSubmissions: unsolved });
    await startGhost();
    await vi.advanceTimersByTimeAsync(100 * SECOND);
    await submit('pass:3'); // same count, reached later than the ghost (60 s)
    await vi.advanceTimersByTimeAsync(EASY_MS);
    expect(endOf()).toMatchObject({ winnerId: GHOST_PLAYER_ID, reason: 'TIMEOUT' });
  });

  it('leaving is a forfeit (and a disconnect past the grace period is a loss)', async () => {
    await startGhost();
    await manager.forfeit(A);
    expect(endOf()).toMatchObject({ winnerId: GHOST_PLAYER_ID, reason: 'FORFEIT' });

    manager.shutdown();
    setup();
    await startGhost();
    manager.userDisconnected(A);
    await vi.advanceTimersByTimeAsync(30 * SECOND);
    expect(endOf()).toMatchObject({ winnerId: GHOST_PLAYER_ID, reason: 'DISCONNECT' });
  });

  it('payloads always flag the ghost: no connection state, never a typing indicator or code', async () => {
    const { matchId } = await startGhost();
    const snapshot = await manager.rejoin(A, matchId);
    expect(snapshot.mode).toBe('GHOST');
    expect(snapshot.opponent).toMatchObject({
      userId: GHOST_PLAYER_ID,
      username: 'ghosty',
      elo: 1050,
      connected: null,
      ghost: { kind: 'ghost', username: 'ghosty', rating: 1050 },
    });
    expect(recorder.last(A, 'match:start').opponent.ghost).toMatchObject({ kind: 'ghost' });
    manager.activity(A);
    await vi.advanceTimersByTimeAsync(EASY_MS);
    expect(recorder.of(A, 'opponent:activity')).toHaveLength(0);
    expect(recorder.of(A, 'opponent:connection')).toHaveLength(0);
    expect(JSON.stringify(recorder.events)).not.toMatch(/"code"\s*:\s*"[^"]*function/);
  });
});

describe('bots', () => {
  it('a bot is used when there is no ghost run; it is clearly labelled and has a fixed rating', async () => {
    setup({ ghostRuns: [] });
    const { matchId, ack } = await startGhost();
    expect(ack.ghost).toEqual({ kind: 'bot', id: 'byte', name: 'Byte', rating: 900 });
    expect(repo.matches.get(matchId)).toMatchObject({
      mode: 'GHOST',
      botId: 'byte',
      ghostUserId: null,
      player2Elo: 900,
    });
    await vi.advanceTimersByTimeAsync(EASY_MS);
    const end = endOf();
    expect(end.summary.players[1].ghost).toMatchObject({ kind: 'bot', name: 'Byte' });
    expect(Object.keys(end.eloChanges)).toEqual([String(A)]);
  });

  it('picks the closest of the 4 bots (900, 1100, 1300, 1500)', () => {
    expect(BOTS.map((b) => b.rating)).toEqual([900, 1100, 1300, 1500]);
    expect([pickBot(700), pickBot(1180), pickBot(1260), pickBot(2400)].map((b) => b.name)).toEqual([
      'Byte',
      'Pixel',
      'Vector',
      'Quantum',
    ]);
  });

  it('bot timelines stay within the match, end with a solve or a partial result', () => {
    const random = seeded(3);
    for (const bot of BOTS) {
      for (const category of ['ALGO', 'DEBUG', 'FRONTEND']) {
        const events = botTimeline({
          bot,
          category,
          difficulty: 'MEDIUM',
          durationMs: EASY_MS,
          testCount: category === 'FRONTEND' ? 1 : 9,
          threshold: 98,
          random,
        });
        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(events.every((e) => e.offsetMs > 0 && e.offsetMs < EASY_MS)).toBe(true);
        expect(events.slice(0, -1).every((e) => !e.accepted)).toBe(true);
        const last = events.at(-1);
        if (category === 'FRONTEND')
          expect(last.accepted ? last.score >= 98 : last.score < 98).toBe(true);
        else expect(last.accepted ? last.passed === 9 : last.passed < 9).toBe(true);
      }
    }
  });
});

describe('ghost selection and timelines (pure)', () => {
  const runs = [
    { id: 'near-unsolved', elo: 1100, solved: false },
    { id: 'near-solved', elo: 950, solved: true },
    { id: 'far', elo: 1700, solved: true },
  ];

  it('prefers ±200, mixes solved and unsolved runs, widens when needed', () => {
    const picks = new Set();
    for (let i = 0; i < 40; i++)
      picks.add(selectGhostRun(runs, { elo: 1000, random: Math.random }).id);
    expect([...picks].sort()).toEqual(['near-solved', 'near-unsolved']);
    expect(selectGhostRun([runs[2]], { elo: 1000 }).id).toBe('far'); // widened to "any"
    expect(selectGhostRun([], { elo: 1000 })).toBeNull();
  });

  it('turns submissions into offsets from the start, within the duration', () => {
    const events = ghostTimeline(
      [
        { createdAt: at(400), status: 'WRONG_ANSWER', passed: 1, total: 4, linesChanged: 3 },
        { createdAt: at(30), status: 'WRONG_ANSWER', passed: 0, total: 4, linesChanged: 1 },
        { createdAt: at(700), status: 'ACCEPTED', passed: 4, total: 4, linesChanged: 2 },
      ],
      { startedAt: T0, durationMs: 600 * SECOND, category: 'DEBUG' },
    );
    expect(events).toEqual([
      { offsetMs: 30_000, accepted: false, passed: 0, total: 4, lines: 1 },
      { offsetMs: 400_000, accepted: false, passed: 1, total: 4, lines: 3 },
    ]);
  });
});

describe('from the ranked queue', () => {
  it('offers "Play a ghost now" after 20 s; accepting leaves the queue', async () => {
    await manager.joinQueue(A);
    await vi.advanceTimersByTimeAsync(19 * SECOND);
    expect(recorder.last(A, 'queue:status')).toMatchObject({
      status: 'searching',
      ghostOffer: false,
    });
    await vi.advanceTimersByTimeAsync(1 * SECOND);
    expect(recorder.last(A, 'queue:status')).toMatchObject({ ghostOffer: true });
    expect(manager.getState(A)).toMatchObject({ type: 'queue', ghostOffer: true });

    const { matchId } = await manager.startGhost(A, { category: 'ALGO' });
    expect(manager.getState(A)).toMatchObject({ type: 'match', matchId });
    expect(manager.matchmaker.has(A)).toBe(false);
    await manager.joinQueue(B); // B can't be paired with A any more
    await vi.advanceTimersByTimeAsync(2 * SECOND);
    expect(recorder.last(B, 'match:found')).toBeUndefined();
  });

  it('never picks the player own runs', async () => {
    setup({ ghostRuns: [run({ userId: A, username: 'alice' })] });
    const { ack } = await startGhost();
    expect(ack.ghost.kind).toBe('bot');
    expect(repo.findGhostRuns).toHaveBeenCalledWith(expect.objectContaining({ excludeUserId: A }));
  });
});
