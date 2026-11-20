/** The renderer service can't be reached (down, network error, overloaded). */
export class RendererUnavailableError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'RendererUnavailableError';
  }
}

/** The renderer refused or failed one render (e.g. RENDER_TIMEOUT, CODE_TOO_LARGE). */
export class RenderFailedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RenderFailedError';
    this.code = code;
  }
}
