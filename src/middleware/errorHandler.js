import { Sentry } from '../config/sentry.js';

export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
    requestId: req.id,
  });
};

export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  let status = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Server Error';

  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_FAILED';
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
    message = `Duplicate value for: ${Object.keys(err.keyValue).join(', ')}`;
  }

  if (err.name === 'CastError') {
    status = 400;
    code = 'VALIDATION_FAILED';
    message = `Invalid ${err.path}: ${err.value}`;
  }

  res.status(status).json({
    success: false,
    code,
    message,
    requestId: req.id,
  });
};