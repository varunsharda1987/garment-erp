/**
 * Frontend Logger Utility
 *
 * Centralized logging for the frontend application with support for
 * different log levels and conditional logging based on environment.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private isDebugEnabled: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.isDebugEnabled = import.meta.env.VITE_DEBUG === 'true' || this.isDevelopment;
  }

  /**
   * Format log entry with timestamp and level
   */
  private formatLog(level: LogLevel, message: string, data?: unknown): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    if (data !== undefined) {
      entry.data = data;
    }
    return entry;
  }

  /**
   * Debug level logging - only in development or when DEBUG enabled
   */
  debug(message: string, data?: unknown): void {
    if (!this.isDebugEnabled) return;

    this.formatLog('debug', message, data);
    console.debug(`[DEBUG] ${message}`, data || '');
  }

  /**
   * Info level logging
   */
  info(message: string, data?: unknown): void {
    this.formatLog('info', message, data);
    console.info(`[INFO] ${message}`, data || '');
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: unknown): void {
    this.formatLog('warn', message, data);
    console.warn(`[WARN] ${message}`, data || '');
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | unknown): void {
    this.formatLog('error', message, error);

    if (error instanceof Error) {
      const errorInfo: { message: string; stack?: string; cause?: unknown } = {
        message: error.message,
        stack: error.stack,
      };
      if (error.cause !== undefined) {
        errorInfo.cause = error.cause;
      }
      console.error(`[ERROR] ${message}`, errorInfo);
    } else {
      console.error(`[ERROR] ${message}`, error || '');
    }
  }

  /**
   * Log API errors with additional context
   */
  apiError(endpoint: string, error: unknown, context?: Record<string, unknown>): void {
    const err = error as { message?: string; response?: { status?: number; statusText?: string; data?: unknown } };
    this.error(`API Error: ${endpoint}`, {
      endpoint,
      error: err?.message || error,
      status: err?.response?.status,
      statusText: err?.response?.statusText,
      data: err?.response?.data,
      ...context,
    });
  }

  /**
   * Log API requests (debug level)
   */
  apiRequest(method: string, endpoint: string, data?: unknown): void {
    this.debug(`API Request: ${method} ${endpoint}`, data);
  }

  /**
   * Log API responses (debug level)
   */
  apiResponse(method: string, endpoint: string, status: number, data?: unknown): void {
    this.debug(`API Response: ${method} ${endpoint} ${status}`, data);
  }

  /**
   * Log component lifecycle events (debug level)
   */
  component(componentName: string, event: string, data?: unknown): void {
    this.debug(`[${componentName}] ${event}`, data);
  }

  /**
   * Log form validation errors
   */
  validation(formName: string, errors: Record<string, string | string[]>): void {
    this.warn(`Form Validation Error: ${formName}`, errors);
  }

  /**
   * Log user actions for analytics/debugging
   */
  userAction(action: string, data?: unknown): void {
    this.info(`User Action: ${action}`, data);
  }
}

// Export singleton instance
const logger = new Logger();

export default logger;

// Export convenience functions
export const logDebug = (message: string, data?: unknown) => logger.debug(message, data);
export const logInfo = (message: string, data?: unknown) => logger.info(message, data);
export const logWarn = (message: string, data?: unknown) => logger.warn(message, data);
export const logError = (message: string, error?: Error | unknown) => logger.error(message, error);
export const logApiError = (endpoint: string, error: unknown, context?: Record<string, unknown>) =>
  logger.apiError(endpoint, error, context);
export const logApiRequest = (method: string, endpoint: string, data?: unknown) =>
  logger.apiRequest(method, endpoint, data);
export const logApiResponse = (method: string, endpoint: string, status: number, data?: unknown) =>
  logger.apiResponse(method, endpoint, status, data);
export const logComponent = (componentName: string, event: string, data?: unknown) =>
  logger.component(componentName, event, data);
export const logValidation = (formName: string, errors: Record<string, string | string[]>) =>
  logger.validation(formName, errors);
export const logUserAction = (action: string, data?: unknown) => logger.userAction(action, data);
