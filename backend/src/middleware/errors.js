/**
 * Wraps an async route handler so thrown errors flow into Express's
 * error middleware instead of crashing the process.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Standard error shape sent to clients.
 */
export function errorMiddleware(err, req, res, _next) {
  // Known validation errors from Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.issues,
    });
  }

  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  const status = err.status || 500;
  const message = status >= 500 ? 'Internal server error' : err.message;

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  return res.status(status).json({ error: message });
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
