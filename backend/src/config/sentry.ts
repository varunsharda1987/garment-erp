/**
 * Sentry Configuration for Error Tracking
 *
 * Integrates Sentry for real-time error monitoring and performance tracking.
 * Configure SENTRY_DSN in environment variables to enable.
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Application } from 'express';
import { version } from '../../package.json';
import { logInfo, logWarn } from '../utils/logger';

/**
 * Initialize Sentry SDK
 *
 * @param app Express application instance
 */
export function initializeSentry(app: Application): void {
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  // Only initialize if DSN is provided
  if (!sentryDsn) {
    logWarn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment,
      release: `garment-erp-backend@${version}`,

      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // Adjust this value in production based on your needs
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

      // Set profilesSampleRate to 1.0 to profile every transaction
      // This is useful for performance optimization
      profilesSampleRate: environment === 'production' ? 0.1 : 1.0,

      // Profiling integration for performance monitoring
      integrations: [
        new ProfilingIntegration(),
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
      ],

      // Don't send errors in test environment
      enabled: environment !== 'test',

      // Ignore common errors that don't need tracking
      ignoreErrors: [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'NetworkError',
        'Non-Error promise rejection captured',
      ],

      // Customize error grouping
      beforeSend(event, hint) {
        const error = hint.originalException;

        // Don't send 401/403 errors (authentication issues)
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status === 401 || status === 403) {
            return null;
          }
        }

        // Add custom context
        if (event.request) {
          event.contexts = event.contexts || {};
          event.contexts.app = {
            app_name: 'Kashaya Fabs ERP',
            app_version: version,
          };
        }

        return event;
      },
    });

    logInfo(`Sentry initialized in ${environment} mode`);
  } catch (error: any) {
    logWarn(`Sentry initialization failed: ${error.message}`);
  }
}

/**
 * Request handler middleware
 * Must be the first middleware
 */
export const sentryRequestHandler = Sentry.Handlers.requestHandler();

/**
 * Tracing middleware for performance monitoring
 */
export const sentryTracingHandler = Sentry.Handlers.tracingHandler();

/**
 * Error handler middleware
 * Must be after all routes and before other error handlers
 */
export const sentryErrorHandler = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    // Capture all errors except 4xx errors
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      return status >= 500;
    }
    return true;
  },
});

/**
 * Manually capture an exception
 *
 * @param error Error to capture
 * @param context Additional context
 */
export function captureException(error: Error, context?: Record<string, any>): void {
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
 * Clear user context
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
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

export default Sentry;
