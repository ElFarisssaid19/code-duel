/**
 * FRONTEND duel rules with the renderer mocked: matchmaking per category/track, threshold win,
 * timeout tiebreaks (best score → fewer characters → earlier submission), draw at 0, separate
 * ratings, and opponents only ever seeing scores.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackRuleError } from '../../src/services/frontend/trackRules.js';
import { frontendTimeoutWinner, MatchManager } from '../../src/services/match/MatchManager.js';
import {
  createFakeJudge,
  createFakeRepo,
  createRecorder,
  makeFrontendProblem,
  makeProblem,
} from './fakes.js';

const A = 1;
const B = 2;
const C = 3;
const EASY_MS = 10 * 60_000;

/**
 * Mock scorer: the CSS drives the result. "score=97.5 chars=40" → score 97.5, 40 characters
 * (default: the CSS length). "violation" → TrackRuleError.
 */
const scoreFrontend = vi.fn(async (problem, { css }) => {
  if (css.includes('violation')) throw new TrackRuleError('css', 'Not allowed');
  const score = Number(/score=([\d.]+)/.exec(css)?.[1] ?? 0);
  const charCount = Number(/chars=(\d+)/.exec(css)?.[1] ?? css.length);
  return {
    score,
    solved: score >= problem.matchThreshold,
    threshold: problem.matchThreshold,
    charCount,
    diffPng: Buffer.from('fake-png'),
  };
});

let repo;
let recorder;
let manager;

function setup({ problems } = {}) {
  repo = createFakeRepo({
    users: [
      { id: A, username: 'alice', elo: 1500, frontend: { elo: 1000 } },
      { id: B, username: 'bob', elo: 1500, frontend: { elo: 1000 } },
      { id: C, username: 'carol', elo: 1000 },
    ],
    problems: problems ?? [
      makeProblem(),
      makeFrontendProblem(),
      makeFrontendProblem({ id: 51, slug: 'html-list', track: 'HTML', matchThreshold: 98 }),
    ],
  });
  recorder = createRecorder();
  manager = new MatchManager({
    repo,
    judge: createFakeJudge(),
    notify: recorder.notify,
    scoreFrontend,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  scoreFrontend.mockClear();
  setup();
});

afterEach(() => {
  manager.shutdown();
  vi.useRealTimers();
});

const flush = () => vi.advanceTimersByTimeAsync(0);
const endOf = (userId) => recorder.last(userId, 'match:end');
const submit = (userId, css, html = '') => manager.submit(userId, { kind: 'frontend', html, css });

async function startFrontend({ track = 'CSS' } = {}) {
  await manager.joinQueue(A, { category: 'FRONTEND', track });
  await manager.joinQueue(B, { category: 'FRONTEND', track });
  await flush();
  const { matchId } = recorder.last(A, 'match:found');
  await manager.rejoin(A, matchId);
  await manager.rejoin(B, matchId);
  await vi.advanceTimersByTimeAsync(3000);
  return matchId;
}

describe('FRONTEND matchmaking', () => {
  it('pairs FRONTEND players together (never with the ALGO queue) and picks a FRONTEND problem', async () => {
    await manager.joinQueue(A, { category: 'FRONTEND' });
    await manager.joinQueue(C); // ALGO
    await flush();
    expect(recorder.last(A, 'match:found')).toBeUndefined();

    await manager.joinQueue(B, { category: 'FRONTEND' });
    await flush();
    const { matchId } = recorder.last(A, 'match:found');
    expect(recorder.last(B, 'match:found')).toEqual({ matchId, mode: 'RANKED' });
    expect(repo.matches.get(matchId)).toMatchObject({ category: 'FRONTEND', testCount: 1 });
    expect(manager.getState(C)).toMatchObject({ type: 'queue', category: 'ALGO' });
  });

  it('respects track filters: HTML and CSS players never meet, "any track" fits both', async () => {
    await manager.joinQueue(A, { category: 'FRONTEND', track: 'HTML' });
    await manager.joinQueue(B, { category: 'FRONTEND', track: 'CSS' });
    await flush();
    expect(recorder.last(A, 'match:found')).toBeUndefined();

    manager.leaveQueue(B);
    await manager.joinQueue(B, { category: 'FRONTEND' }); // any track
    await flush();
    const { matchId } = recorder.last(A, 'match:found');
    await manager.rejoin(A, matchId);
    await manager.rejoin(B, matchId);
    await vi.advanceTimersByTimeAsync(3000);
    const start = recorder.last(A, 'match:start');
    expect(start.problem).toMatchObject({ category: 'FRONTEND', track: 'HTML', slug: 'html-list' });
    expect(repo.matches.get(matchId)).toMatchObject({ track: 'HTML' });
  });

  it('uses the FRONTEND rating for matchmaking (ALGO 1500 players start at 1000 here)', async () => {
    await manager.joinQueue(A, { category: 'FRONTEND' });
    await manager.joinQueue(B, { category: 'FRONTEND' });
    await flush();
    const { matchId } = recorder.last(A, 'match:found');
    expect(repo.matches.get(matchId)).toMatchObject({ player1Elo: 1000, player2Elo: 1000 });
  });

  it('refuses a category without problems', async () => {
    setup({ problems: [makeProblem()] });
    await expect(manager.joinQueue(A, { category: 'FRONTEND' })).rejects.toMatchObject({
      code: 'NO_PROBLEMS',
    });
    expect(manager.getState(A)).toEqual({ type: 'idle' });
  });

  it('private rooms take a category and track', async () => {
    const room = await manager.createRoom(A, {
      difficulty: 'ANY',
      category: 'FRONTEND',
      track: 'CSS',
    });
    expect(room).toMatchObject({ category: 'FRONTEND', track: 'CSS' });
    const { matchId } = await manager.joinRoom(B, { code: room.code });
    expect(repo.matches.get(matchId)).toMatchObject({
      mode: 'PRIVATE',
      category: 'FRONTEND',
      track: 'CSS',
    });
  });
});

describe('FRONTEND scoring rules', () => {
  it('the first player to reach the threshold wins (SOLVED); only FRONTEND ratings change', async () => {
    const matchId = await startFrontend();
    const first = await submit(A, 'score=97.25');
    expect(first.result).toMatchObject({
      score: 97.25,
      solved: false,
      threshold: 99.5,
      diffImage: expect.any(String),
    });
    expect(recorder.last(B, 'opponent:progress')).toEqual({
      userId: A,
      passed: 0,
      total: 1,
      attempts: 1,
      score: 97.25,
      threshold: 99.5,
    });

    await vi.advanceTimersByTimeAsync(3000);
    await submit(B, 'score=99.5');
    expect(endOf(A)).toMatchObject({ winnerId: B, reason: 'SOLVED', category: 'FRONTEND' });
    expect(endOf(A).summary.players.find((p) => p.userId === B)).toMatchObject({
      result: 'win',
      passed: 1,
      score: 99.5,
    });

    const [, data, statUpdates] = repo.finishMatch.mock.calls[0];
    expect(data).toMatchObject({ player1Score: 97.25, player2Score: 99.5 });
    expect(statUpdates.every((u) => u.category === 'FRONTEND')).toBe(true);
    const alice = repo.users.get(A);
    const bob = repo.users.get(B);
    expect(bob.frontend).toMatchObject({ elo: 1016, wins: 1 });
    expect(alice.frontend).toMatchObject({ elo: 984, losses: 1 });
    expect([alice.elo, alice.wins, alice.losses, bob.elo, bob.wins]).toEqual([1500, 0, 0, 1500, 0]); // ALGO untouched
    expect(repo.submissions.at(-1)).toMatchObject({
      matchId,
      language: 'css',
      code: '',
      css: 'score=99.5',
      status: 'ACCEPTED',
      score: 99.5,
    });
  });

  it('opponents only ever see scores: never code, previews or diff images', async () => {
    await startFrontend();
    await submit(A, 'score=50 SECRET_CSS_MARKER');
    const toB = recorder.events.filter((e) => e.userId === B);
    expect(JSON.stringify(toB)).not.toContain('SECRET_CSS_MARKER');
    expect(JSON.stringify(toB)).not.toContain(Buffer.from('fake-png').toString('base64'));
    expect(recorder.last(B, 'opponent:progress').score).toBe(50);
  });

  it('on timeout the best score wins (a later, worse submission does not count)', async () => {
    await startFrontend();
    await submit(A, 'score=95');
    await vi.advanceTimersByTimeAsync(3000);
    await submit(A, 'score=40');
    await submit(B, 'score=90');
    await vi.advanceTimersByTimeAsync(EASY_MS);
    expect(endOf(A)).toMatchObject({ winnerId: A, reason: 'TIMEOUT' });
  });

  it('scores within 0.01: fewer characters wins', async () => {
    await startFrontend();
    await submit(A, 'score=90.01 chars=300');
    await submit(B, 'score=90 chars=120');
    await vi.advanceTimersByTimeAsync(EASY_MS);
    expect(endOf(A)).toMatchObject({ winnerId: B, reason: 'TIMEOUT' });
  });

  it('same score and characters: the earlier submission wins', async () => {
    await startFrontend();
    await submit(B, 'score=80 chars=100');
    await vi.advanceTimersByTimeAsync(5000);
    await submit(A, 'score=80 chars=100');
    await vi.advanceTimersByTimeAsync(EASY_MS);
    expect(endOf(A)).toMatchObject({ winnerId: B, reason: 'TIMEOUT' });
  });

  it('a same-score resubmission with fewer characters becomes the best result', async () => {
    await startFrontend();
    await submit(A, 'score=80 chars=200');
    await submit(B, 'score=80 chars=150');
    await vi.advanceTimersByTimeAsync(3000);
    await submit(A, 'score=80 chars=100');
    await vi.advanceTimersByTimeAsync(EASY_MS);
    expect(endOf(A)).toMatchObject({ winnerId: A, reason: 'TIMEOUT' });
  });

  it('both at 0 → draw (ranked: half a point each)', async () => {
    await startFrontend();
    await vi.advanceTimersByTimeAsync(EASY_MS);
    expect(endOf(A)).toMatchObject({ winnerId: null, reason: 'TIMEOUT' });
    expect(repo.users.get(A).frontend).toMatchObject({ elo: 1000, draws: 1 });
  });

  it('pure tiebreak function', () => {
    const p = (userId, bestScore, bestChars, reachedAt) => ({
      userId,
      bestScore,
      bestChars,
      reachedAt,
    });
    expect(frontendTimeoutWinner(p(1, 0, null, null), p(2, 0, null, null))).toBeNull();
    expect(frontendTimeoutWinner(p(1, 70, 10, 5), p(2, 70.02, 999, 9))).toBe(2);
    expect(frontendTimeoutWinner(p(1, 70.01, 50, 5), p(2, 70, 40, 9))).toBe(2);
    expect(frontendTimeoutWinner(p(1, 70, 40, 5), p(2, 70, 40, 9))).toBe(1);
    expect(frontendTimeoutWinner(p(1, 70, 40, 5), p(2, 70, 40, 5))).toBeNull();
    expect(frontendTimeoutWinner(p(1, 0.005, 10, 5), p(2, 0, null, null))).toBe(1); // no submission = ∞ chars
  });
});

describe('FRONTEND in-match rules', () => {
  it('submit is rate-limited (1 per 3 s) and has no "run"', async () => {
    await startFrontend();
    await submit(A, 'score=10');
    await expect(submit(A, 'score=20')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(manager.run(A, { language: 'javascript', code: 'x' })).rejects.toMatchObject({
      code: 'NOT_SUPPORTED',
    });
  });

  it('refuses an ALGO payload in a FRONTEND match (and vice versa)', async () => {
    await startFrontend();
    await expect(manager.submit(A, { language: 'javascript', code: 'x' })).rejects.toMatchObject({
      code: 'WRONG_CATEGORY',
    });
  });

  it('track rule violations are refused and do not count as attempts', async () => {
    await startFrontend();
    await expect(submit(A, 'violation')).rejects.toMatchObject({ code: 'TRACK_RULE_VIOLATION' });
    expect(manager.snapshot(manager.matches.values().next().value, A).me.attempts).toBe(0);
  });

  it('the snapshot carries the category, track and the FRONTEND brief (no reference)', async () => {
    const matchId = await startFrontend();
    const state = await manager.rejoin(A, matchId);
    expect(state).toMatchObject({ category: 'FRONTEND', track: 'CSS' });
    expect(state.problem).toMatchObject({
      category: 'FRONTEND',
      canvas: { width: 400, height: 300 },
      threshold: 99.5,
      targetImageUrl: '/api/problems/css-circle/target.png',
    });
    expect(state.me).toMatchObject({ score: 0, threshold: 99.5 });
    expect(JSON.stringify(state)).not.toMatch(/reference/i);
  });
});
