/** The judge backend could not be reached or answered with an HTTP error. */
export class JudgeUnavailableError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'JudgeUnavailableError';
  }
}
