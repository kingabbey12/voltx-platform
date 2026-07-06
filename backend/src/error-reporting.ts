import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN ?? '';

export const errorReportingEnabled = dsn.length > 0;

if (errorReportingEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
  });
}

export function captureException(error: unknown): void {
  if (!errorReportingEnabled) {
    return;
  }
  Sentry.captureException(error);
}
