import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../lib/errors.js';

const FIELD_LABELS = { username: 'Username', email: 'Email' };

/**
 * Which fields a Prisma P2002 (unique violation) is about. With driver adapters the
 * field list isn't in `meta.target`; it has to be read from the index name, which Prisma
 * names `<Model>_<field>[_<field>]_key`.
 */
function uniqueViolationFields(err) {
  const target = err.meta?.target;
  if (Array.isArray(target)) return target;
  if (typeof target === 'string') return [target];

  const cause = err.meta?.driverAdapterError?.cause;
  if (cause?.constraint?.fields) return cause.constraint.fields;
  const index = cause?.constraint?.index;
  if (index) {
    const prefix = `${cause.table ?? err.meta?.modelName}_`;
    return index.replace(prefix, '').replace(/_key$/, '').split('_');
  }
  return [];
}

/** Maps any thrown value to { status, error: { code, message, details? } }. */
function toErrorResponse(err) {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      error: { code: err.code, message: err.message, details: err.details },
    };
  }

  if (err instanceof z.ZodError) {
    const { formErrors, fieldErrors } = z.flattenError(err);
    return {
      status: 400,
      error: {
        code: 'VALIDATION_ERROR',
        message: formErrors[0] ?? 'Invalid request data',
        details: fieldErrors,
      },
    };
  }

  if (err?.code === 'P2002') {
    const field = uniqueViolationFields(err).find((f) => FIELD_LABELS[f]);
    const message = field ? `${FIELD_LABELS[field]} is already taken` : 'Resource already exists';
    return {
      status: 409,
      error: { code: 'CONFLICT', message, details: field ? { [field]: [message] } : undefined },
    };
  }

  // body-parser errors (malformed JSON, payload too large, ...)
  if (err?.type === 'entity.parse.failed') {
    return {
      status: 400,
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    };
  }
  const status = err?.status ?? err?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return { status, error: { code: 'BAD_REQUEST', message: err.message } };
  }

  return {
    status: 500,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.isProd ? 'Internal Server Error' : (err?.message ?? 'Internal Server Error'),
    },
  };
}

/**
 * Central error handler: every error response has the shape { error: { code, message, details? } }.
 * Express 5 forwards rejected promises from async handlers here automatically.
 */
// Express identifies error handlers by their 4 arguments, so keep `next` in the signature.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const { status, error } = toErrorResponse(err);
  if (status >= 500) console.error(err);

  res.status(status).json({
    error: {
      ...error,
      ...(env.isDev && status >= 500 && err?.stack && { stack: err.stack }),
    },
  });
}
