import * as Sentry from '@sentry/node';
import { env } from './env.js';

export const initSentry = () => {
  if (!env.sentryDsn) {
    console.warn('Sentry DSN not set - skipping Sentry initialization');
    return;
  }
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: 0.1,
  });
};

export { Sentry };