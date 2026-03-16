/**
 * Sentry Error Tracking Configuration
 * Import this in src/app/layout.tsx or instrumentation.ts
 */

export const sentryConfig = {
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
};

/**
 * Capture an error with Sentry context.
 * Gracefully no-ops if Sentry is not configured.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryConfig.dsn) return;
  console.error('[Sentry]', error, context);
  // In production: Sentry.captureException(error, { extra: context });
}
