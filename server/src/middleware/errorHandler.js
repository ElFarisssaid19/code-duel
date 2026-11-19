import { env } from '../config/env.js';

/**
 * Central error handler. Express 5 forwards rejected promises from async
 * handlers here automatically. Throw errors with a `status` to set the code.
 */
// Express identifies error handlers by their 4 arguments, so keep `next` in the signature.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = Number.isInteger(err.status ?? err.statusCode)
    ? (err.status ?? err.statusCode)
    : 500;
  if (status >= 500) console.error(err);

  res.status(status).json({
    error: {
      message: status >= 500 && env.isProd ? 'Internal Server Error' : err.message,
      ...(env.isDev && status >= 500 && { stack: err.stack }),
    },
  });
}
