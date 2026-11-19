/** A user-facing duel error; sent to clients as { code, message }. */
export class MatchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MatchError';
    this.code = code;
  }
}
