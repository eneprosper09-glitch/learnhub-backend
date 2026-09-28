import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

const noop = (req, res, next) => next();

const handler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    code: 'RATE_LIMITED',
    message,
    requestId: req.id,
  });
};

export const globalLimiter = isTest
  ? noop
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
      handler: handler('Too many requests, please slow down'),
    });

export const authLimiter = isTest
  ? noop
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      handler: handler('Too many login attempts, try again later'),
    });

export const registerLimiter = isTest
  ? noop
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      handler: handler('Too many accounts created from this IP'),
    });

export const forgotPasswordLimiter = isTest
  ? noop
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        const email = String(req.body?.email || '').toLowerCase().trim();
        if (email) return email;
        return ipKeyGenerator(req.ip);
      },
      handler: handler('Too many password reset requests for this email'),
    });

export const uploadLimiter = isTest
  ? noop
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      handler: handler('Too many uploads, try again later'),
    });