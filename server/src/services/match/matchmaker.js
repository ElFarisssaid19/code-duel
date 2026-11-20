/**
 * Ranked matchmaking. The queue lives behind a small store interface (add/remove/get/has/list)
 * so the in-memory implementation can be swapped for Redis later.
 */

export const DEFAULT_WINDOW = Object.freeze({
  initial: 100, // ±100 ELO when joining
  step: 50, // widens by 50…
  stepMs: 5000, // …every 5 seconds
  max: 500, // up to ±500
  anyoneAfterMs: 60_000, // after 60 s: anyone
});

/** Allowed ELO difference after waiting `elapsedMs` (Infinity = anyone). */
export function eloWindow(elapsedMs, window = DEFAULT_WINDOW) {
  if (elapsedMs >= window.anyoneAfterMs) return Infinity;
  return Math.min(window.initial + window.step * Math.floor(elapsedMs / window.stepMs), window.max);
}

/** In-memory queue store. */
export function createMemoryQueueStore() {
  const entries = new Map();
  return {
    add: (entry) => void entries.set(entry.userId, entry),
    remove: (userId) => entries.delete(userId),
    get: (userId) => entries.get(userId) ?? null,
    has: (userId) => entries.has(userId),
    list: () => [...entries.values()].sort((a, b) => a.joinedAt - b.joinedAt),
  };
}

/**
 * Same category (ALGO | FRONTEND; entries without one are ALGO) and compatible FRONTEND tracks:
 * a player without a track preference (any track) fits any track.
 */
export function sameQueue(a, b) {
  if ((a.category ?? 'ALGO') !== (b.category ?? 'ALGO')) return false;
  return !a.track || !b.track || a.track === b.track;
}

/**
 * Pairs queued players. Oldest first; each is matched with the closest-rated compatible player.
 * Two players are compatible when they are in the same queue (sameQueue) and their ELO
 * difference (in that category) fits the WIDER of their two windows (a player who has waited
 * long can be matched with a newcomer). Never pairs a user with themselves.
 */
export function findPairs(entries, now, window = DEFAULT_WINDOW) {
  const waiting = [...entries].sort((a, b) => a.joinedAt - b.joinedAt);
  const paired = new Set();
  const pairs = [];
  for (const a of waiting) {
    if (paired.has(a.userId)) continue;
    let best = null;
    for (const b of waiting) {
      if (b.userId === a.userId || paired.has(b.userId) || !sameQueue(a, b)) continue;
      const diff = Math.abs(a.elo - b.elo);
      const allowed = Math.max(
        eloWindow(now - a.joinedAt, window),
        eloWindow(now - b.joinedAt, window),
      );
      if (diff <= allowed && (!best || diff < best.diff)) best = { entry: b, diff };
    }
    if (best) {
      paired.add(a.userId);
      paired.add(best.entry.userId);
      pairs.push([a, best.entry]);
    }
  }
  return pairs;
}

export class Matchmaker {
  /**
   * @param onPair (a, b) => void      called with two queue entries (already removed from the queue)
   * @param onStatus (entry, status) => void   periodic { elapsedMs, window } for each waiting player
   */
  constructor({
    onPair,
    onStatus = () => {},
    store = createMemoryQueueStore(),
    tickMs = 1000,
    window = DEFAULT_WINDOW,
  }) {
    this.onPair = onPair;
    this.onStatus = onStatus;
    this.store = store;
    this.tickMs = tickMs;
    this.window = window;
    this.interval = null;
  }

  /** entry: { userId, username, elo, category?, track? } (elo is the category's rating) */
  join(entry) {
    this.store.add({ ...entry, joinedAt: Date.now() });
    this.interval ??= setInterval(() => this.tick(), this.tickMs);
    this.tick();
  }

  leave(userId) {
    const removed = this.store.remove(userId);
    this.stopIfEmpty();
    return removed;
  }

  has(userId) {
    return this.store.has(userId);
  }

  status(userId, now = Date.now()) {
    const entry = this.store.get(userId);
    if (!entry) return null;
    const window = eloWindow(now - entry.joinedAt, this.window);
    return { elapsedMs: now - entry.joinedAt, window: Number.isFinite(window) ? window : null };
  }

  tick() {
    const now = Date.now();
    for (const [a, b] of findPairs(this.store.list(), now, this.window)) {
      this.store.remove(a.userId);
      this.store.remove(b.userId);
      this.onPair(a, b);
    }
    for (const entry of this.store.list()) this.onStatus(entry, this.status(entry.userId, now));
    this.stopIfEmpty();
  }

  stopIfEmpty() {
    if (this.interval && this.store.list().length === 0) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  shutdown() {
    clearInterval(this.interval);
    this.interval = null;
  }
}
