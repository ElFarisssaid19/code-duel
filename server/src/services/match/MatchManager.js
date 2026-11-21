/**
 * Real-time duels: presence (one queue / room / match per user), private rooms, ranked
 * matchmaking, and the match state machine with all timers. Pure business logic: sockets,
 * the database and the judge are injected, so it is testable without any of them.
 *
 * Match states: WAITING (players found, waiting for both clients to connect)
 *   → COUNTDOWN (3 s) → ACTIVE → FINISHED | CANCELLED
 *
 * Categories: ALGO (judged by go-judge, progress = tests passed) and FRONTEND (HTML/CSS scored
 * by the renderer, progress = best score %). Each match is one category; ranked matches only
 * change the players' rating in that category.
 *
 * SECURITY: problem.tests (with hidden inputs/expected outputs) stays in memory here. Only
 * publicProblem(), toPublicResult() and counts ever go into events or acks. For FRONTEND
 * matches, an opponent only ever sees scores, never code or previews.
 */
import { linesChanged } from '../debug/linesChanged.js';
import { calculateEloChange } from '../elo.js';
import { publicFrontendProblem } from '../frontend/publicProblem.js';
import { scoreFrontendSubmission } from '../frontend/scoring.js';
import { trackLanguage, TrackRuleError } from '../frontend/trackRules.js';
import { JudgeUnavailableError, STATUS } from '../judge/index.js';
import { RendererUnavailableError, RenderFailedError } from '../renderer/index.js';
import { toPublicResult } from '../judge/publicResult.js';
import { MatchError } from './errors.js';
import {
  archivedGhost,
  botTimeline,
  GHOST_K_FACTOR,
  GHOST_PLAYER_ID,
  ghostTimeline,
  pickBot,
  selectGhostRun,
} from './ghosts.js';
import { Matchmaker } from './matchmaker.js';
import {
  chooseProblem,
  privateDifficulties,
  RECENT_MATCHES,
  rankedDifficulties,
} from './problemPicker.js';
import { generateRoomCode, normalizeRoomCode } from './roomCodes.js';

const MINUTE = 60_000;

export const DEFAULT_MATCH_CONFIG = Object.freeze({
  countdownMs: 3000,
  /** WAITING → CANCELLED if both players' clients haven't joined by then. */
  readyTimeoutMs: 30_000,
  disconnectGraceMs: 30_000,
  roomTtlMs: 10 * MINUTE,
  rematchWindowMs: 2 * MINUTE,
  /** Finished matches stay in memory this long (rejoin shows the result, rematch works). */
  keepFinishedMs: 2 * MINUTE,
  /** match:run + match:submit share this cooldown, per player. */
  execCooldownMs: 3000,
  activityThrottleMs: 1000,
  durationsMs: { EASY: 10 * MINUTE, MEDIUM: 15 * MINUTE, HARD: 20 * MINUTE },
  /** In the ranked queue, offer "Play a ghost now" after this long. */
  ghostOfferAfterMs: 20_000,
  /** DEBUG matches are shorter: fixing bugs, not writing a solution. */
  debugDurationsMs: { EASY: 6 * MINUTE, MEDIUM: 10 * MINUTE, HARD: 15 * MINUTE },
});

const LIVE = new Set(['WAITING', 'COUNTDOWN', 'ACTIVE']);

const BUSY_MESSAGES = {
  queue: 'You are already searching for a ranked match.',
  room: 'You already have an open private room.',
  match: 'You are already in a match.',
};

export class MatchManager {
  /**
   * @param repo    createMatchRepository() or a fake
   * @param judge   { judgeSolution, judgeSubmission } from services/judge
   * @param scoreFrontend (problem, { html, css }) => { score, solved, threshold, charCount,
   *                diffPng }: FRONTEND scoring (services/frontend/scoring.js; mocked in tests)
   * @param notify  (userId, event, payload) => void, delivers to all of the user's tabs
   */
  constructor({
    repo,
    judge,
    notify,
    scoreFrontend = scoreFrontendSubmission,
    config = {},
    random = Math.random,
    matchmakerOptions = {},
  }) {
    this.repo = repo;
    this.judge = judge;
    this.scoreFrontend = scoreFrontend;
    // Ghosts and bots are not connected users: nothing is ever sent "to" them.
    this.notify = (userId, event, payload) => {
      if (userId !== GHOST_PLAYER_ID) notify(userId, event, payload);
    };
    this.config = { ...DEFAULT_MATCH_CONFIG, ...config };
    this.random = random;

    this.presence = new Map(); // userId → { type: 'queue' } | { type: 'room', code } | { type: 'match', matchId }
    this.rooms = new Map(); // code → room
    this.matches = new Map(); // matchId → match (live, or recently finished)
    this.rematchOffers = new Map(); // finished private matchId → offer
    this.matchmaker = new Matchmaker({
      onPair: (a, b) => this.#onPair(a, b),
      onStatus: (entry, status) =>
        this.notify(entry.userId, 'queue:status', {
          status: 'searching',
          ...status,
          ghostOffer: status.elapsedMs >= this.config.ghostOfferAfterMs,
        }),
      ...matchmakerOptions,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Presence

  /** What the user is doing right now (used to restore the UI and redirect to a live match). */
  getState(userId) {
    const presence = this.presence.get(userId);
    if (!presence) return { type: 'idle' };
    if (presence.type === 'queue') {
      const status = this.matchmaker.status(userId);
      return {
        type: 'queue',
        category: presence.category,
        track: presence.track,
        ...status,
        ghostOffer: (status?.elapsedMs ?? 0) >= this.config.ghostOfferAfterMs,
      };
    }
    if (presence.type === 'room')
      return { type: 'room', room: this.#roomView(this.rooms.get(presence.code)) };
    const match = this.matches.get(presence.matchId);
    return { type: 'match', matchId: presence.matchId, status: match?.status ?? 'WAITING' };
  }

  #assertIdle(userId) {
    const presence = this.presence.get(userId);
    if (presence) throw new MatchError('ALREADY_BUSY', BUSY_MESSAGES[presence.type]);
  }

  // ---------------------------------------------------------------------------------------------
  // Ranked queue

  /** Ranked queue of a category (ALGO | FRONTEND); FRONTEND players can pick one track. */
  async joinQueue(userId, { category = 'ALGO', track = null } = {}) {
    this.#assertIdle(userId);
    this.presence.set(userId, { type: 'queue', category, track }); // reserve before any await
    try {
      const [user, candidates] = await Promise.all([
        this.repo.getUser(userId, category), // fresh ELO (the session copy can be stale)
        this.repo.listProblemCandidates({ category, track }),
      ]);
      if (!user) throw new MatchError('NOT_FOUND', 'User not found');
      if (candidates.length === 0) {
        throw new MatchError('NO_PROBLEMS', 'There are no problems in this category yet.');
      }
      if (this.presence.get(userId)?.type !== 'queue') return { status: 'idle' }; // left meanwhile
      this.#cancelOffersFor(userId);
      this.matchmaker.join({ userId, username: user.username, elo: user.elo, category, track });
    } catch (err) {
      this.presence.delete(userId);
      throw err;
    }
    return this.presence.get(userId)?.type === 'queue'
      ? { status: 'searching', category, track, ...this.matchmaker.status(userId) }
      : { status: 'matched' }; // paired immediately
  }

  leaveQueue(userId) {
    if (this.presence.get(userId)?.type !== 'queue') return { status: 'idle' };
    this.matchmaker.leave(userId);
    this.presence.delete(userId);
    this.notify(userId, 'queue:status', { status: 'idle' });
    return { status: 'idle' };
  }

  #onPair(a, b) {
    this.#createMatch({
      mode: 'RANKED',
      userIds: [a.userId, b.userId],
      category: a.category ?? 'ALGO',
      track: a.track ?? b.track ?? null,
    }).catch((err) => {
      this.#reportBackgroundError('ranked match creation failed', err, [a.userId, b.userId]);
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Ghost / bot matches

  /**
   * Starts a GHOST match: a replay of another player's past ranked run in this category (rating
   * within ±200, widened if needed), or a bot when there is no run at all. Works from the ranked
   * queue too (the player leaves the queue). Only the human's rating changes (K=16).
   */
  async startGhost(userId, { category = 'ALGO', track = null } = {}) {
    if (this.presence.get(userId)?.type === 'queue') this.leaveQueue(userId);
    this.#assertIdle(userId);
    this.presence.set(userId, { type: 'match', matchId: null }); // reserved while we hit the DB
    try {
      const user = await this.repo.getUser(userId, category);
      if (!user) throw new MatchError('NOT_FOUND', 'User not found');
      this.#cancelOffersFor(userId);
      const runs = await this.repo.findGhostRuns({ category, track, excludeUserId: userId });
      const run = selectGhostRun(runs, { elo: user.elo, random: this.random });
      const match = run
        ? await this.#createGhostMatch({ user, category, track, run })
        : await this.#createBotMatch({ user, category, track });
      return { matchId: match.id, mode: 'GHOST', ghost: match.players[1].ghost };
    } catch (err) {
      if (this.presence.get(userId)?.matchId === null) this.presence.delete(userId);
      throw err;
    }
  }

  async #createGhostMatch({ user, category, track, run }) {
    const problem = await this.repo.loadProblem(run.problemId);
    const durationMs = this.#durationOf(category, problem);
    const submissions = await this.repo.loadRunSubmissions(run.matchId, run.userId);
    const ghost = {
      kind: 'ghost',
      userId: run.userId,
      username: run.username,
      rating: run.elo,
      replayOf: run.endedAt ? new Date(run.endedAt).toISOString() : null,
      sourceMatchId: run.matchId,
    };
    const timeline = ghostTimeline(submissions, {
      startedAt: run.startedAt,
      durationMs,
      category,
    });
    return this.#openGhostMatch({ user, category, track, problem, durationMs, ghost, timeline });
  }

  async #createBotMatch({ user, category, track }) {
    const [candidates, recentIds] = await Promise.all([
      this.repo.listProblemCandidates({ category, track }),
      this.repo.recentProblemIds([user.id], RECENT_MATCHES),
    ]);
    const picked = chooseProblem({
      candidates,
      difficulties: rankedDifficulties(user.elo),
      recentIds,
      random: this.random,
    });
    if (!picked) throw new MatchError('NO_PROBLEMS', 'There are no problems in this category yet.');
    const problem = await this.repo.loadProblem(picked.id);
    const durationMs = this.#durationOf(category, problem);
    const bot = pickBot(user.elo);
    const ghost = { kind: 'bot', id: bot.id, name: bot.name, rating: bot.rating };
    const timeline = botTimeline({
      bot,
      category,
      difficulty: problem.difficulty,
      durationMs,
      testCount: category === 'FRONTEND' ? 1 : problem.tests.length,
      threshold: category === 'FRONTEND' ? thresholdOfProblem(problem) : undefined,
      bugCount: problem.bugCount ?? 1,
      random: this.random,
    });
    return this.#openGhostMatch({ user, category, track, problem, durationMs, ghost, timeline });
  }

  async #openGhostMatch({ user, category, track, problem, durationMs, ghost, timeline }) {
    const testCount = category === 'FRONTEND' ? 1 : problem.tests.length;
    const { id } = await this.repo.createMatch({
      mode: 'GHOST',
      category,
      ...(category === 'FRONTEND' && { track }),
      status: 'WAITING',
      player1Id: user.id,
      player2Id: null,
      problemId: problem.id,
      durationMs,
      testCount,
      player1Elo: user.elo,
      player2Elo: ghost.rating,
      ghostUserId: ghost.kind === 'ghost' ? ghost.userId : null,
      ghostSourceMatchId: ghost.kind === 'ghost' ? ghost.sourceMatchId : null,
      botId: ghost.kind === 'bot' ? ghost.id : null,
    });
    const opponent = {
      ...newPlayer({
        id: GHOST_PLAYER_ID,
        username: ghost.kind === 'ghost' ? ghost.username : ghost.name,
        elo: ghost.rating,
      }),
      ready: true, // a replay is always "there"; it has no connection state
      ghost,
      timeline,
    };
    const match = {
      id,
      mode: 'GHOST',
      category,
      track,
      roomCode: null,
      difficultyChoice: 'ANY',
      status: 'WAITING',
      problem,
      durationMs,
      testCount,
      players: [newPlayer(user), opponent],
      createdAt: Date.now(),
      startsAt: null,
      startedAt: null,
      endsAt: null,
      result: null,
      timers: {},
    };
    this.matches.set(id, match);
    this.presence.set(user.id, { type: 'match', matchId: id });
    match.timers.ready = setTimeout(() => this.#cancel(match), this.config.readyTimeoutMs);
    this.notify(user.id, 'match:found', { matchId: id, mode: 'GHOST' });
    return match;
  }

  /** One replayed submission of the ghost/bot, at its recorded time. */
  async #ghostEvent(match, event) {
    if (match.status !== 'ACTIVE') return;
    const [human, ghost] = match.players;
    const now = Date.now();
    ghost.attempts += 1;
    if (match.category === 'FRONTEND') {
      if (isBetterFrontendResult({ score: event.score, charCount: event.charCount }, ghost)) {
        ghost.bestScore = event.score;
        ghost.bestChars = event.charCount;
        ghost.reachedAt = now;
      }
      if (event.accepted) ghost.passed = 1;
    } else {
      applyJudgedResult(ghost, { passed: event.passed, lines: event.lines ?? null }, now);
    }
    this.notify(human.userId, 'opponent:progress', this.#progress(match, ghost));
    if (event.accepted) {
      ghost.solvedAt = now;
      await this.#finish(match, { winnerId: GHOST_PLAYER_ID, reason: 'SOLVED' });
    }
  }

  #durationOf(category, problem) {
    return (category === 'DEBUG' ? this.config.debugDurationsMs : this.config.durationsMs)[
      problem.difficulty
    ];
  }

  // ---------------------------------------------------------------------------------------------
  // Private rooms

  async createRoom(userId, { difficulty, category = 'ALGO', track = null }) {
    this.#assertIdle(userId);
    const code = this.#uniqueRoomCode();
    this.presence.set(userId, { type: 'room', code });
    try {
      const [user, candidates] = await Promise.all([
        this.repo.getUser(userId, category),
        this.repo.listProblemCandidates({ category, track }),
      ]);
      if (
        !chooseProblem({ candidates, difficulties: privateDifficulties(difficulty), strict: true })
      ) {
        throw new MatchError(
          'NO_PROBLEMS',
          `There are no ${difficulty.toLowerCase()} problems yet.`,
        );
      }
      this.#cancelOffersFor(userId);
      const room = {
        code,
        difficulty,
        category,
        track,
        host: { userId, username: user.username, elo: user.elo },
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.roomTtlMs,
      };
      room.timer = setTimeout(() => this.#closeRoom(room, 'EXPIRED'), this.config.roomTtlMs);
      this.rooms.set(code, room);
      const view = this.#roomView(room);
      this.notify(userId, 'room:update', view);
      return view;
    } catch (err) {
      this.presence.delete(userId);
      throw err;
    }
  }

  async joinRoom(userId, { code }) {
    const room = this.rooms.get(normalizeRoomCode(code));
    if (!room) throw new MatchError('ROOM_NOT_FOUND', 'This room does not exist or has expired.');
    if (room.host.userId === userId) {
      throw new MatchError(
        'CANNOT_PLAY_YOURSELF',
        "You can't join your own room. Share the code with a friend.",
      );
    }
    this.#assertIdle(userId);

    // Synchronously take the room and reserve both players, so no other join/queue can race us.
    this.rooms.delete(room.code);
    clearTimeout(room.timer);
    const userIds = [room.host.userId, userId];
    for (const id of userIds) this.presence.set(id, { type: 'match', matchId: null });

    try {
      const guest = await this.repo.getUser(userId, room.category);
      const view = {
        ...this.#roomView(room),
        status: 'starting',
        players: [room.host, guest].map(playerSummary),
      };
      for (const id of userIds) this.notify(id, 'room:update', view);

      const match = await this.#createMatch({
        mode: 'PRIVATE',
        userIds,
        difficultyChoice: room.difficulty,
        roomCode: room.code,
        category: room.category,
        track: room.track,
      });
      return { code: room.code, matchId: match.id };
    } catch (err) {
      for (const id of userIds) {
        if (this.presence.get(id)?.matchId === null) this.presence.delete(id);
      }
      this.notify(room.host.userId, 'room:update', {
        ...this.#roomView(room),
        status: 'closed',
        reason: 'ERROR',
      });
      throw err;
    }
  }

  leaveRoom(userId) {
    const presence = this.presence.get(userId);
    if (presence?.type !== 'room') return { status: 'idle' };
    this.#closeRoom(this.rooms.get(presence.code), 'LEFT');
    return { status: 'idle' };
  }

  #closeRoom(room, reason) {
    if (!room || this.rooms.get(room.code) !== room) return;
    clearTimeout(room.timer);
    this.rooms.delete(room.code);
    this.presence.delete(room.host.userId);
    this.notify(room.host.userId, 'room:update', {
      ...this.#roomView(room),
      status: 'closed',
      reason,
    });
  }

  #uniqueRoomCode() {
    let code;
    do code = generateRoomCode((max) => Math.floor(this.random() * max));
    while (this.rooms.has(code));
    return code;
  }

  #roomView(room) {
    if (!room) return null;
    return {
      code: room.code,
      difficulty: room.difficulty,
      category: room.category,
      track: room.track,
      status: 'open',
      players: [playerSummary(room.host)],
      expiresAt: room.expiresAt,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Match creation and lifecycle

  async #createMatch({
    mode,
    userIds,
    difficultyChoice = 'ANY',
    roomCode = null,
    category = 'ALGO',
    track = null,
  }) {
    const [id1, id2] = userIds;
    if (id1 === id2)
      throw new MatchError('CANNOT_PLAY_YOURSELF', "You can't play against yourself.");
    for (const id of userIds) {
      this.#cancelOffersFor(id);
      this.presence.set(id, { type: 'match', matchId: null }); // reserved while we hit the DB
    }

    try {
      const users = await Promise.all(userIds.map((id) => this.repo.getUser(id, category)));
      const [candidates, recentIds] = await Promise.all([
        this.repo.listProblemCandidates({ category, track }),
        this.repo.recentProblemIds(userIds, RECENT_MATCHES),
      ]);
      const averageElo = (users[0].elo + users[1].elo) / 2;
      const picked = chooseProblem({
        candidates,
        difficulties:
          mode === 'RANKED'
            ? rankedDifficulties(averageElo)
            : privateDifficulties(difficultyChoice),
        recentIds,
        strict: mode === 'PRIVATE',
        random: this.random,
      });
      if (!picked) throw new MatchError('NO_PROBLEMS', 'No problem is available for this match.');

      const problem = await this.repo.loadProblem(picked.id);
      const durationMs = (
        category === 'DEBUG' ? this.config.debugDurationsMs : this.config.durationsMs
      )[problem.difficulty];
      // FRONTEND: one "test" (passed = 1 once solved); progress is the best score.
      const testCount = category === 'FRONTEND' ? 1 : problem.tests.length;
      const { id } = await this.repo.createMatch({
        mode,
        ...(category !== 'ALGO' && { category }),
        ...(category === 'FRONTEND' && { track }),
        status: 'WAITING',
        roomCode,
        player1Id: id1,
        player2Id: id2,
        problemId: problem.id,
        durationMs,
        testCount,
        player1Elo: users[0].elo,
        player2Elo: users[1].elo,
      });

      const match = {
        id,
        mode,
        category,
        track,
        roomCode,
        difficultyChoice,
        status: 'WAITING',
        problem,
        durationMs,
        testCount,
        players: users.map((u) => newPlayer(u)),
        createdAt: Date.now(),
        startsAt: null,
        startedAt: null,
        endsAt: null,
        result: null,
        timers: {},
      };
      this.matches.set(id, match);
      for (const uid of userIds) this.presence.set(uid, { type: 'match', matchId: id });
      match.timers.ready = setTimeout(() => this.#cancel(match), this.config.readyTimeoutMs);

      for (const uid of userIds) this.notify(uid, 'match:found', { matchId: id, mode });
      return match;
    } catch (err) {
      for (const uid of userIds) {
        if (this.presence.get(uid)?.matchId === null) this.presence.delete(uid);
      }
      throw err;
    }
  }

  /**
   * A player's client (re)joins a match: first join after match:found, or after a refresh /
   * network loss. Returns the full snapshot (match:state).
   */
  async rejoin(userId, matchId) {
    const match = this.matches.get(matchId);
    if (!match) return this.#archivedState(userId, matchId);
    const { player, opponent } = this.#playersOf(match, userId);

    player.connected = true;
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
      player.disconnectedAt = null;
      this.notify(opponent.userId, 'opponent:connection', { connected: true });
    }
    if (!player.ready) {
      player.ready = true;
      if (match.status === 'WAITING' && opponent.ready) this.#startCountdown(match);
    }
    return this.snapshot(match, userId);
  }

  #startCountdown(match) {
    clearTimeout(match.timers.ready);
    match.status = 'COUNTDOWN';
    match.startsAt = Date.now() + this.config.countdownMs;
    this.#persist(match, { status: 'COUNTDOWN' });
    for (const p of match.players) {
      this.notify(p.userId, 'match:countdown', {
        matchId: match.id,
        startsAt: match.startsAt,
        serverNow: Date.now(),
      });
    }
    match.timers.countdown = setTimeout(() => this.#start(match), this.config.countdownMs);
  }

  #start(match) {
    if (match.status !== 'COUNTDOWN') return;
    match.status = 'ACTIVE';
    match.startedAt = Date.now();
    match.endsAt = match.startedAt + match.durationMs;
    this.#persist(match, {
      status: 'ACTIVE',
      startedAt: new Date(match.startedAt),
      endsAt: new Date(match.endsAt),
    });
    for (const p of match.players) {
      const opponent = this.#opponentOf(match, p.userId);
      this.notify(p.userId, 'match:start', {
        matchId: match.id,
        problem: publicProblem(match.problem),
        endsAt: match.endsAt,
        serverNow: Date.now(),
        me: this.#playerView(match, p),
        opponent: this.#playerView(match, opponent),
      });
    }
    match.timers.end = setTimeout(() => this.#finishByTimeout(match), match.durationMs);
    if (match.mode === 'GHOST') {
      // Replay the ghost/bot at its recorded offsets from the start.
      match.timers.ghost = match.players[1].timeline.map((event) =>
        setTimeout(() => {
          this.#ghostEvent(match, event).catch((err) =>
            this.#reportBackgroundError('ghost replay failed', err),
          );
        }, event.offsetMs),
      );
    }
  }

  /** Full state for one player (match:state). Never includes hidden tests. */
  snapshot(match, userId) {
    const { player, opponent } = this.#playersOf(match, userId);
    const now = Date.now();
    return {
      matchId: match.id,
      mode: match.mode,
      category: match.category,
      track: match.track,
      status: match.status,
      roomCode: match.roomCode,
      problem: match.startedAt ? publicProblem(match.problem) : null, // revealed at start only
      durationMs: match.durationMs,
      startsAt: match.startsAt,
      endsAt: match.endsAt,
      remainingMs: match.status === 'ACTIVE' ? Math.max(0, match.endsAt - now) : null,
      serverNow: now,
      me: this.#playerView(match, player),
      opponent: this.#playerView(match, opponent),
      result: match.result,
      rematch: this.#rematchView(match.id),
    };
  }

  // ---------------------------------------------------------------------------------------------
  // In-match actions

  /** Runs the sample tests only. Doesn't count as an attempt or change progress. */
  async run(userId, { language, code }) {
    const { match, player } = this.#activeMatchOf(userId);
    if (match.category === 'FRONTEND') {
      throw new MatchError(
        'NOT_SUPPORTED',
        'Frontend problems have no run step: use the live preview, then submit.',
      );
    }
    this.#checkCooldown(player);
    const verdict = await this.#judge(() =>
      this.judge.judgeSolution({
        ...this.#judgeOptions(match, language, code),
        tests: match.problem.tests.filter((t) => !t.hidden),
      }),
    );
    const payload = { matchId: match.id, result: toPublicResult('run', verdict) };
    this.notify(userId, 'match:run:result', payload);
    return payload;
  }

  /** Runs all tests (samples and hidden in separate executions), records progress, may end the match. */
  async submit(userId, body) {
    const { match, player } = this.#activeMatchOf(userId);
    const frontendPayload = body?.kind === 'frontend';
    if ((match.category === 'FRONTEND') !== frontendPayload) {
      throw new MatchError(
        'WRONG_CATEGORY',
        match.category === 'FRONTEND'
          ? 'This is a frontend match: send { html, css }.'
          : 'This is an algorithm match: send { language, code }.',
      );
    }
    if (frontendPayload) return this.#submitFrontend(match, player, body);
    const { language, code } = body;
    this.#checkCooldown(player);
    player.attempts += 1;

    let verdict;
    try {
      verdict = await this.#judge(() =>
        this.judge.judgeSubmission({
          ...this.#judgeOptions(match, language, code),
          tests: match.problem.tests,
        }),
      );
    } catch (err) {
      player.attempts -= 1; // the judge failed, not the player
      throw err;
    }

    // DEBUG: lines changed compared to the buggy code (the starter code of that language).
    const lines =
      match.category === 'DEBUG'
        ? linesChanged(match.problem.starterCode?.[language] ?? '', code)
        : null;
    const submission = await this.repo
      .saveSubmission({
        matchId: match.id,
        userId,
        problemId: match.problem.id,
        language,
        code,
        status: verdict.status,
        passed: verdict.passed,
        total: verdict.total,
        timeMs: verdict.timeMs,
        ...(lines !== null && { linesChanged: lines }),
      })
      .catch((err) => {
        console.error('[match] could not save submission:', err.message);
        return null;
      });

    const stillActive = match.status === 'ACTIVE';
    if (stillActive) applyJudgedResult(player, { passed: verdict.passed, lines }, Date.now());
    const payload = {
      matchId: match.id,
      result: toPublicResult('submit', verdict),
      ...(lines !== null && { linesChanged: lines }),
      submission: submission && {
        id: submission.id,
        status: verdict.status,
        passed: verdict.passed,
        total: verdict.total,
        createdAt: submission.createdAt,
      },
      progress: this.#progress(match, player),
    };
    this.notify(userId, 'match:submit:result', payload);

    if (stillActive) {
      const opponent = this.#opponentOf(match, userId);
      this.notify(opponent.userId, 'opponent:progress', this.#progress(match, player));
      if (verdict.status === STATUS.ACCEPTED && verdict.passed === match.testCount) {
        player.solvedAt = Date.now();
        await this.#finish(match, { winnerId: userId, reason: 'SOLVED' });
      }
    }
    return payload;
  }

  /**
   * FRONTEND submit: renders and scores the page. Progress = best score (ties: fewer characters).
   * Reaching the problem's threshold wins the match (SOLVED).
   */
  async #submitFrontend(match, player, { html, css }) {
    this.#checkCooldown(player);
    player.attempts += 1;
    let result;
    try {
      result = await this.scoreFrontend(match.problem, { html, css });
    } catch (err) {
      player.attempts -= 1; // rule violations and renderer failures don't count as attempts
      throw toFrontendMatchError(err);
    }

    const { track } = match.problem;
    const submission = await this.repo
      .saveSubmission({
        matchId: match.id,
        userId: player.userId,
        problemId: match.problem.id,
        language: trackLanguage(track),
        code: track === 'CSS' ? '' : html,
        css: track === 'HTML' ? '' : css,
        status: result.solved ? 'ACCEPTED' : 'WRONG_ANSWER',
        passed: result.solved ? 1 : 0,
        total: 1,
        score: result.score,
        charCount: result.charCount,
      })
      .catch((err) => {
        console.error('[match] could not save submission:', err.message);
        return null;
      });

    const stillActive = match.status === 'ACTIVE';
    if (stillActive && isBetterFrontendResult(result, player)) {
      player.bestScore = result.score;
      player.bestChars = result.charCount;
      player.reachedAt = Date.now();
    }
    if (stillActive && result.solved) player.passed = 1;

    const payload = {
      matchId: match.id,
      result: {
        mode: 'submit',
        score: result.score,
        solved: result.solved,
        threshold: result.threshold,
        charCount: result.charCount,
        diffImage: result.diffPng.toString('base64'),
      },
      submission: submission && {
        id: submission.id,
        status: result.solved ? 'ACCEPTED' : 'WRONG_ANSWER',
        score: result.score,
        charCount: result.charCount,
        createdAt: submission.createdAt,
      },
      progress: this.#progress(match, player),
    };
    this.notify(player.userId, 'match:submit:result', payload);

    if (stillActive) {
      const opponent = this.#opponentOf(match, player.userId);
      this.notify(opponent.userId, 'opponent:progress', this.#progress(match, player));
      if (result.solved) {
        player.solvedAt = Date.now();
        await this.#finish(match, { winnerId: player.userId, reason: 'SOLVED' });
      }
    }
    return payload;
  }

  async forfeit(userId) {
    const presence = this.presence.get(userId);
    const match = presence?.type === 'match' ? this.matches.get(presence.matchId) : null;
    if (!match || !LIVE.has(match.status))
      throw new MatchError('NOT_IN_MATCH', 'You are not in a match.');
    if (match.status === 'WAITING') {
      await this.#cancel(match);
    } else {
      await this.#finish(match, {
        winnerId: this.#opponentOf(match, userId).userId,
        reason: 'FORFEIT',
      });
    }
    return { matchId: match.id };
  }

  /** "Opponent is typing" ping, throttled per player. */
  activity(userId) {
    const presence = this.presence.get(userId);
    const match = presence?.type === 'match' ? this.matches.get(presence.matchId) : null;
    if (match?.status !== 'ACTIVE') return;
    const { player, opponent } = this.#playersOf(match, userId);
    const now = Date.now();
    if (now - player.lastActivityAt < this.config.activityThrottleMs) return;
    player.lastActivityAt = now;
    this.notify(opponent.userId, 'opponent:activity', { at: now });
  }

  // ---------------------------------------------------------------------------------------------
  // Connections

  /** Called when the user's LAST socket (all tabs) disconnects. */
  userDisconnected(userId) {
    const presence = this.presence.get(userId);
    if (presence?.type === 'queue') this.leaveQueue(userId);
    // Rooms survive a refresh; they expire after roomTtlMs without a second player.
    if (presence?.type !== 'match') return;

    const match = this.matches.get(presence.matchId);
    if (!match) return;
    const { player, opponent } = this.#playersOf(match, userId);
    player.connected = false;
    if (!['COUNTDOWN', 'ACTIVE'].includes(match.status) || player.graceTimer) return;

    // The match keeps running; after the grace period the opponent wins.
    player.disconnectedAt = Date.now();
    const graceEndsAt = player.disconnectedAt + this.config.disconnectGraceMs;
    player.graceTimer = setTimeout(() => {
      player.graceTimer = null;
      this.#finish(match, { winnerId: opponent.userId, reason: 'DISCONNECT' }).catch((err) =>
        this.#reportBackgroundError('disconnect finish failed', err),
      );
    }, this.config.disconnectGraceMs);
    this.notify(opponent.userId, 'opponent:connection', { connected: false, graceEndsAt });
  }

  // ---------------------------------------------------------------------------------------------
  // Ending

  #finishByTimeout(match) {
    const [a, b] = match.players;
    let winnerId = null;
    if (match.category === 'FRONTEND') {
      winnerId = frontendTimeoutWinner(a, b);
    } else if (match.category === 'DEBUG') {
      winnerId = debugTimeoutWinner(a, b);
    } else if (a.passed !== b.passed) {
      winnerId = (a.passed > b.passed ? a : b).userId;
    } else if (a.passed > 0 && a.reachedAt !== b.reachedAt) {
      winnerId = (a.reachedAt < b.reachedAt ? a : b).userId; // reached that count first
    }
    return this.#finish(match, { winnerId, reason: 'TIMEOUT' }).catch((err) =>
      this.#reportBackgroundError('timeout finish failed', err),
    );
  }

  async #finish(match, { winnerId, reason }) {
    if (!LIVE.has(match.status)) return; // already ended (e.g. both solved at once)
    match.status = 'FINISHED';
    this.#clearTimers(match);
    const endedAt = Date.now();
    const [p1, p2] = match.players;

    let deltas = [null, null];
    const ghostMatch = match.mode === 'GHOST';
    if (match.mode === 'RANKED' || ghostMatch) {
      const score1 = winnerId === null ? 0.5 : winnerId === p1.userId ? 1 : 0;
      const { a, b } = calculateEloChange(
        p1.elo,
        p2.elo,
        score1,
        ghostMatch ? GHOST_K_FACTOR : undefined,
      );
      // Against a ghost or bot, only the human's rating changes.
      deltas = ghostMatch ? [a, null] : [a, b];
    }
    const rated = (p, i) => deltas[i] !== null && !p.ghost;
    const outcome = (p) => (winnerId === null ? 'draw' : p.userId === winnerId ? 'win' : 'loss');
    const frontend = match.category === 'FRONTEND';
    const debug = match.category === 'DEBUG';

    match.result = {
      matchId: match.id,
      mode: match.mode,
      ...((frontend || debug) && { category: match.category }),
      winnerId,
      reason,
      eloChanges:
        match.mode === 'PRIVATE'
          ? null // private rooms are unranked
          : Object.fromEntries(
              match.players.flatMap((p, i) =>
                rated(p, i)
                  ? [[p.userId, { before: p.elo, after: p.elo + deltas[i], delta: deltas[i] }]]
                  : [],
              ),
            ),
      summary: {
        durationMs: match.startedAt ? endedAt - match.startedAt : 0,
        players: match.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          result: outcome(p),
          passed: p.passed,
          total: match.testCount,
          attempts: p.attempts,
          solveTimeMs: p.solvedAt && match.startedAt ? p.solvedAt - match.startedAt : null,
          ...(frontend && { score: p.bestScore, charCount: p.bestChars }),
          ...(debug && { linesChanged: p.bestLines }),
          ...(p.ghost && { ghost: p.ghost }),
        })),
      },
    };

    this.#releasePlayers(match);
    if (match.mode === 'PRIVATE') this.#openRematchOffer(match);

    try {
      await this.repo.finishMatch(
        match.id,
        {
          status: 'FINISHED',
          endReason: reason,
          // winnerId can only point to a real user: a ghost/bot win is stored as winnerIsGhost.
          winnerId: winnerId === GHOST_PLAYER_ID ? null : winnerId,
          ...(ghostMatch && { winnerIsGhost: winnerId === GHOST_PLAYER_ID }),
          endedAt: new Date(endedAt),
          player1Passed: p1.passed,
          player2Passed: p2.passed,
          player1ReachedAt: p1.reachedAt ? new Date(p1.reachedAt) : null,
          player2ReachedAt: p2.reachedAt ? new Date(p2.reachedAt) : null,
          player1EloChange: deltas[0],
          player2EloChange: deltas[1],
          ...(frontend && {
            player1Score: p1.bestScore,
            player2Score: p2.bestScore,
            player1Chars: p1.bestChars,
            player2Chars: p2.bestChars,
          }),
          ...(debug && { player1Lines: p1.bestLines, player2Lines: p2.bestLines }),
        },
        match.mode === 'PRIVATE'
          ? []
          : match.players.flatMap((p, i) =>
              rated(p, i)
                ? [
                    {
                      userId: p.userId,
                      category: match.category,
                      eloDelta: deltas[i],
                      result: outcome(p),
                    },
                  ]
                : [],
            ),
      );
    } catch (err) {
      console.error(`[match] could not persist the end of match ${match.id}:`, err);
    }

    for (const p of match.players) this.notify(p.userId, 'match:end', match.result);
  }

  async #cancel(match) {
    if (!LIVE.has(match.status)) return;
    match.status = 'CANCELLED';
    this.#clearTimers(match);
    match.result = {
      matchId: match.id,
      mode: match.mode,
      winnerId: null,
      reason: 'CANCELLED',
      eloChanges: null,
      summary: {
        durationMs: 0,
        players: match.players.map((p) => ({
          ...playerSummary(p),
          result: 'cancelled',
          passed: 0,
          total: match.testCount,
          attempts: 0,
          solveTimeMs: null,
        })),
      },
    };
    this.#releasePlayers(match);
    await this.repo
      .updateMatch(match.id, { status: 'CANCELLED', endReason: 'CANCELLED', endedAt: new Date() })
      .catch((err) =>
        console.error(`[match] could not persist cancel of ${match.id}:`, err.message),
      );
    for (const p of match.players) this.notify(p.userId, 'match:end', match.result);
  }

  #releasePlayers(match) {
    for (const p of match.players) {
      if (this.presence.get(p.userId)?.matchId === match.id) this.presence.delete(p.userId);
    }
    match.timers.cleanup = setTimeout(() => {
      if (this.matches.get(match.id) === match) this.matches.delete(match.id);
    }, this.config.keepFinishedMs);
  }

  #clearTimers(match) {
    for (const key of ['ready', 'countdown', 'end']) clearTimeout(match.timers[key]);
    for (const timer of match.timers.ghost ?? []) clearTimeout(timer);
    for (const p of match.players) {
      clearTimeout(p.graceTimer);
      p.graceTimer = null;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Rematch (private rooms only; both players must accept)

  #openRematchOffer(match) {
    const offer = {
      matchId: match.id,
      roomCode: match.roomCode,
      difficultyChoice: match.difficultyChoice,
      category: match.category,
      track: match.track,
      players: match.players.map((p) => p.userId),
      requestedBy: new Set(),
      status: 'open',
    };
    offer.timer = setTimeout(() => this.#closeOffer(offer, 'expired'), this.config.rematchWindowMs);
    this.rematchOffers.set(match.id, offer);
  }

  async requestRematch(userId, { matchId } = {}) {
    const offer = matchId
      ? this.rematchOffers.get(matchId)
      : [...this.rematchOffers.values()].reverse().find((o) => o.players.includes(userId));
    if (!offer || !offer.players.includes(userId)) {
      throw new MatchError('REMATCH_UNAVAILABLE', 'A rematch is no longer possible.');
    }
    this.#assertIdle(userId);
    offer.requestedBy.add(userId);

    if (offer.requestedBy.size < 2) {
      this.#notifyOffer(offer, 'pending');
      return this.#offerView(offer, 'pending');
    }

    const opponentId = offer.players.find((id) => id !== userId);
    if (this.presence.has(opponentId)) {
      this.#closeOffer(offer, 'cancelled');
      throw new MatchError('REMATCH_UNAVAILABLE', 'Your opponent is busy.');
    }
    clearTimeout(offer.timer);
    this.rematchOffers.delete(offer.matchId);
    this.#notifyOffer(offer, 'accepted');
    const match = await this.#createMatch({
      mode: 'PRIVATE',
      userIds: offer.players,
      difficultyChoice: offer.difficultyChoice,
      roomCode: offer.roomCode,
      category: offer.category,
      track: offer.track,
    });
    return { ...this.#offerView(offer, 'accepted'), newMatchId: match.id };
  }

  #cancelOffersFor(userId) {
    for (const offer of [...this.rematchOffers.values()]) {
      if (offer.players.includes(userId)) this.#closeOffer(offer, 'cancelled');
    }
  }

  #closeOffer(offer, status) {
    if (this.rematchOffers.get(offer.matchId) !== offer) return;
    clearTimeout(offer.timer);
    this.rematchOffers.delete(offer.matchId);
    this.#notifyOffer(offer, status);
  }

  #notifyOffer(offer, status) {
    for (const id of offer.players)
      this.notify(id, 'rematch:update', this.#offerView(offer, status));
  }

  #offerView(offer, status) {
    return { matchId: offer.matchId, status, requestedBy: [...offer.requestedBy] };
  }

  #rematchView(matchId) {
    const offer = this.rematchOffers.get(matchId);
    return offer ? this.#offerView(offer, 'pending') : null;
  }

  // ---------------------------------------------------------------------------------------------
  // Helpers

  #playersOf(match, userId) {
    const player = match.players.find((p) => p.userId === userId);
    if (!player) throw new MatchError('MATCH_NOT_FOUND', 'Match not found.');
    return { player, opponent: this.#opponentOf(match, userId) };
  }

  #opponentOf(match, userId) {
    return match.players.find((p) => p.userId !== userId);
  }

  #activeMatchOf(userId) {
    const presence = this.presence.get(userId);
    const match = presence?.type === 'match' ? this.matches.get(presence.matchId) : null;
    if (!match || match.status !== 'ACTIVE')
      throw new MatchError('MATCH_NOT_ACTIVE', 'The match is not running.');
    return { match, player: this.#playersOf(match, userId).player };
  }

  #checkCooldown(player) {
    const now = Date.now();
    if (now - player.lastExecAt < this.config.execCooldownMs) {
      throw new MatchError(
        'RATE_LIMITED',
        'You can run code once every 3 seconds. Please wait a moment.',
      );
    }
    player.lastExecAt = now;
  }

  #judgeOptions(match, language, code) {
    const functionName = match.problem.functionName?.[language];
    if (!functionName)
      throw new MatchError('UNSUPPORTED_LANGUAGE', `This problem has no ${language} version.`);
    return { language, code, functionName, timeLimitMs: match.problem.timeLimitMs };
  }

  async #judge(fn) {
    let verdict;
    try {
      verdict = await fn();
    } catch (err) {
      if (err instanceof JudgeUnavailableError) {
        console.error('[judge]', err.message);
        throw new MatchError(
          'JUDGE_UNAVAILABLE',
          'The code runner is unavailable. Try again in a moment.',
        );
      }
      throw err;
    }
    if (verdict.status === STATUS.INTERNAL_ERROR) {
      console.error('[judge] internal error:', verdict.error ?? 'no details');
      throw new MatchError('JUDGE_ERROR', 'The code runner failed to run your code. Try again.');
    }
    return verdict;
  }

  #playerView(match, p) {
    return {
      userId: p.userId,
      username: p.username,
      elo: p.elo,
      // A replay has no connection state (no "offline" badge, no typing indicator).
      connected: p.ghost ? null : p.connected,
      ...this.#progress(match, p),
      ...(p.ghost && { ghost: p.ghost }),
    };
  }

  /**
   * ALGO: tests passed. DEBUG: also the lines changed of the best submission. FRONTEND: also the
   * best score and the threshold to reach.
   */
  #progress(match, p) {
    const progress = {
      userId: p.userId,
      passed: p.passed,
      total: match.testCount,
      attempts: p.attempts,
    };
    if (match.category === 'DEBUG') return { ...progress, linesChanged: p.bestLines };
    if (match.category !== 'FRONTEND') return progress;
    return { ...progress, score: p.bestScore, threshold: thresholdOfMatch(match) };
  }

  #persist(match, data) {
    this.repo
      .updateMatch(match.id, data)
      .catch((err) => console.error(`[match] could not update match ${match.id}:`, err.message));
  }

  /** Rejoining a match no longer in memory: show its final state from the DB. */
  async #archivedState(userId, matchId) {
    const row = await this.repo.getMatch(matchId);
    if (!row || (row.player1Id !== userId && row.player2Id !== userId)) {
      throw new MatchError('MATCH_NOT_FOUND', 'Match not found.');
    }
    const players = [
      {
        ...row.player1,
        elo: row.player1Elo,
        passed: row.player1Passed,
        eloChange: row.player1EloChange,
        score: row.player1Score === null ? null : Number(row.player1Score),
      },
      {
        ...(row.player2 ?? archivedGhost(row)),
        elo: row.player2Elo,
        passed: row.player2Passed,
        eloChange: row.player2EloChange,
        score: row.player2Score === null ? null : Number(row.player2Score),
      },
    ];
    const frontend = row.category === 'FRONTEND';
    const winnerId = row.winnerIsGhost ? GHOST_PLAYER_ID : row.winnerId;
    const view = (p) => ({
      userId: p.id,
      username: p.username,
      elo: p.elo,
      connected: p.ghost ? null : false,
      ...(p.ghost && { ghost: p.ghost }),
      passed: p.passed,
      total: row.testCount,
      attempts: null,
      ...(frontend && { score: p.score ?? 0 }),
    });
    const me = players.find((p) => p.id === userId);
    const opponent = players.find((p) => p.id !== userId);
    return {
      matchId: row.id,
      mode: row.mode,
      category: row.category,
      track: row.track,
      status: LIVE.has(row.status) ? 'CANCELLED' : row.status, // live in DB but not in memory = lost
      roomCode: row.roomCode,
      problem: null,
      durationMs: row.durationMs,
      startsAt: null,
      endsAt: row.endsAt?.getTime() ?? null,
      remainingMs: null,
      serverNow: Date.now(),
      me: view(me),
      opponent: view(opponent),
      result: {
        matchId: row.id,
        mode: row.mode,
        ...(frontend && { category: row.category }),
        winnerId,
        reason: row.endReason ?? 'CANCELLED',
        eloChanges:
          row.mode !== 'PRIVATE' && row.player1EloChange !== null
            ? Object.fromEntries(
                players
                  .filter((p) => p.eloChange !== null)
                  .map((p) => [
                    p.id,
                    { before: p.elo, after: p.elo + p.eloChange, delta: p.eloChange },
                  ]),
              )
            : null,
        summary: {
          durationMs: row.startedAt && row.endedAt ? row.endedAt - row.startedAt : 0,
          players: players.map((p) => ({
            userId: p.id,
            username: p.username,
            result: winnerId === null ? 'draw' : winnerId === p.id ? 'win' : 'loss',
            passed: p.passed,
            total: row.testCount,
            attempts: null,
            solveTimeMs: null,
            ...(frontend && { score: p.score ?? 0, charCount: null }),
            ...(p.ghost && { ghost: p.ghost }),
          })),
        },
      },
      rematch: this.#rematchView(row.id),
    };
  }

  #reportBackgroundError(what, err, userIds = []) {
    if (!(err instanceof MatchError)) console.error(`[match] ${what}:`, err);
    const error =
      err instanceof MatchError
        ? { code: err.code, message: err.message }
        : { code: 'INTERNAL_ERROR', message: 'Could not start the match.' };
    for (const id of userIds) this.notify(id, 'match:error', error);
  }

  /** Stops every timer (graceful shutdown, tests). */
  shutdown() {
    this.matchmaker.shutdown();
    for (const room of this.rooms.values()) clearTimeout(room.timer);
    for (const match of this.matches.values()) {
      this.#clearTimers(match);
      clearTimeout(match.timers.cleanup);
    }
    for (const offer of this.rematchOffers.values()) clearTimeout(offer.timer);
  }
}

function newPlayer(user) {
  return {
    userId: user.id,
    username: user.username,
    elo: user.elo,
    ready: false,
    connected: false,
    passed: 0,
    reachedAt: null,
    // FRONTEND: best score so far and the character count of that submission
    bestScore: 0,
    bestChars: null,
    // DEBUG: lines changed of the best submission
    bestLines: null,
    attempts: 0,
    solvedAt: null,
    lastExecAt: -Infinity,
    lastActivityAt: -Infinity,
    graceTimer: null,
    disconnectedAt: null,
  };
}

const playerSummary = (p) => ({ userId: p.userId ?? p.id, username: p.username, elo: p.elo });

/** The problem as players see it: sample tests only (FRONTEND: the brief, never the reference). */
export function publicProblem(problem) {
  if (problem.category === 'FRONTEND') return publicFrontendProblem(problem);
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    // DEBUG: starterCode is the buggy code to fix.
    ...(problem.category === 'DEBUG' && { category: 'DEBUG', bugCount: problem.bugCount }),
    description: problem.description,
    starterCode: problem.starterCode,
    timeLimitMs: problem.timeLimitMs,
    samples: problem.tests
      .filter((t) => !t.hidden)
      .map((t, index) => ({ index, input: t.input, expected: t.expected })),
  };
}

const thresholdOfMatch = (match) => publicFrontendProblem(match.problem).threshold;

/** Same score within 0.01 counts as a tie. */
const SCORE_EPSILON = 0.01 + 1e-9;

/** A player's new FRONTEND result is better: higher score, or same score with fewer characters. */
function isBetterFrontendResult(result, player) {
  if (result.score > player.bestScore) return true;
  return (
    result.score === player.bestScore &&
    player.bestChars !== null &&
    result.charCount < player.bestChars
  );
}

/**
 * FRONTEND timeout rules: both at 0 → draw. Otherwise the best score wins; scores within 0.01
 * → fewer characters wins → earlier submission (of that best result) wins → draw.
 */
export function frontendTimeoutWinner(a, b) {
  if (a.bestScore === 0 && b.bestScore === 0) return null;
  if (Math.abs(a.bestScore - b.bestScore) > SCORE_EPSILON) {
    return (a.bestScore > b.bestScore ? a : b).userId;
  }
  const charsA = a.bestChars ?? Infinity;
  const charsB = b.bestChars ?? Infinity;
  if (charsA !== charsB) return (charsA < charsB ? a : b).userId;
  if (a.reachedAt !== null && b.reachedAt !== null && a.reachedAt !== b.reachedAt) {
    return (a.reachedAt < b.reachedAt ? a : b).userId;
  }
  return null;
}

function toFrontendMatchError(err) {
  if (err instanceof TrackRuleError) return new MatchError('TRACK_RULE_VIOLATION', err.message);
  if (err instanceof RenderFailedError) {
    return err.code === 'RENDER_TIMEOUT'
      ? new MatchError('RENDER_TIMEOUT', 'Your page took more than 5 seconds to render.')
      : new MatchError(err.code, err.message);
  }
  if (err instanceof RendererUnavailableError) {
    console.error('[renderer]', err.message);
    return new MatchError(
      'RENDERER_UNAVAILABLE',
      'The renderer is unavailable. Try again in a moment.',
    );
  }
  return err;
}

/**
 * ALGO/DEBUG progress: more tests passed is better; for DEBUG, the same count with fewer lines
 * changed is better too (it becomes the result that counts, at this time).
 */
export function applyJudgedResult(player, { passed, lines = null }, at) {
  if (passed > player.passed) {
    player.passed = passed;
    player.bestLines = lines;
    player.reachedAt = at;
  } else if (
    lines !== null &&
    passed > 0 &&
    passed === player.passed &&
    (player.bestLines === null || lines < player.bestLines)
  ) {
    player.bestLines = lines;
    player.reachedAt = at;
  }
}

/**
 * DEBUG timeout rules: both at 0 tests → draw. Otherwise most tests passed → fewer lines changed
 * → earlier submission (of that best result) → draw.
 */
export function debugTimeoutWinner(a, b) {
  if (a.passed === 0 && b.passed === 0) return null;
  if (a.passed !== b.passed) return (a.passed > b.passed ? a : b).userId;
  const linesA = a.bestLines ?? Infinity;
  const linesB = b.bestLines ?? Infinity;
  if (linesA !== linesB) return (linesA < linesB ? a : b).userId;
  if (a.reachedAt !== null && b.reachedAt !== null && a.reachedAt !== b.reachedAt) {
    return (a.reachedAt < b.reachedAt ? a : b).userId;
  }
  return null;
}

const thresholdOfProblem = (problem) => publicFrontendProblem(problem).threshold;
