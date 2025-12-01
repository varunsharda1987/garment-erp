/**
 * Sentry Configuration for Frontend Error Tracking
 *
 * Integrates Sentry for real-time error monitoring and performance tracking
 * in the React frontend application.
 */

import * as Sentry from '@sentry/react';
import { version } from '../../package.json';

/**
 * Initialize Sentry SDK
 *
 * Should be called as early as possible in the application lifecycle
 */
export function initializeSentry(): void {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.MODE || 'development';

  // Only initialize if DSN is provided
  if (!sentryDsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment,
      release: `garment-erp-frontend@${version}`,

      // Set tracesSampleRate to capture performance data
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

      // Capture Replay sessions for debugging
      // Adjust sample rates for production
      replaysSessionSampleRate: environment === 'production' ? 0.1 : 1.0,
      replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors

      // React-specific integrations
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],

      // Don't send errors in development
      enabled: environment === 'production',

      // Ignore common errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'cancelled',
      ],

      // Filter out sensitive data
      beforeSend(event, hint) {
        const error = hint.originalException;

        // Don't send 401/403 errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status?: number }).status;
          if (status === 401 || status === 403) {
            return null;
          }
        }

        // Remove sensitive data from request
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.Authorization;
            delete event.request.headers.Cookie;
          }
        }

        // Add custom context
        event.contexts = event.contexts || {};
        event.contexts.app = {
          app_name: 'Kashaya Fabs ERP',
          app_version: version,
        };

        return event;
      },
    });

    console.info(`Sentry initialized in ${environment} mode`);
  } catch (error: unknown) {
    const err = error as Error;
    console.warn(`Sentry initialization failed: ${err.message}`);
  }
}

/**
 * Manually capture an exception
 *
 * @param error Error to capture
 * @param context Additional context
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

/**
 * Capture a message
 *
 * @param message Message to capture
 * @param level Severity level
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 *
 * @param user User information
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  username?: string;
}): void {
  Sentry.setUser(user);
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 *
 * @param message Breadcrumb message
 * @param category Category
 * @param data Additional data
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Create ErrorBoundary component
 *
 * Usage:
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <App />
 * </ErrorBoundary>
 */
export const ErrorBoundary = Sentry.ErrorBoundary;

/**
 * Performance monitoring for React components
 *
 * Usage:
 * const ProfiledComponent = withProfiler(MyComponent);
 */
export const withProfiler = Sentry.withProfiler;

export default Sentry;
