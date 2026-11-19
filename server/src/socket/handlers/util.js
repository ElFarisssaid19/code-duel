import { z } from 'zod';
import { MatchError } from '../../services/match/errors.js';

function toSocketError(err) {
  if (err instanceof MatchError) return { code: err.code, message: err.message };
  if (err instanceof z.ZodError) {
    const issue = err.issues[0];
    return { code: 'VALIDATION_ERROR', message: issue?.message ?? 'Invalid payload' };
  }
  console.error('[socket] unexpected error:', err);
  return { code: 'INTERNAL_ERROR', message: 'Something went wrong.' };
}

/**
 * Registers a request/response event: validates the payload with zod, runs the handler, and
 * answers through the acknowledgement callback with { ok: true, data } or
 * { ok: false, error: { code, message } }.
 */
export function createOn(socket) {
  return function on(event, schema, handler) {
    socket.on(event, async (...args) => {
      const ack = typeof args.at(-1) === 'function' ? args.pop() : () => {};
      try {
        const payload = schema ? schema.parse(args[0] ?? undefined) : undefined;
        const data = await handler(payload);
        ack({ ok: true, data: data ?? null });
      } catch (err) {
        ack({ ok: false, error: toSocketError(err) });
      }
    });
  };
}
