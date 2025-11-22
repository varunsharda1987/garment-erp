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
  data?: any;
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
  private formatLog(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data && { data }),
    };
  }

  /**
   * Debug level logging - only in development or when DEBUG enabled
   */
  debug(message: string, data?: any): void {
    if (!this.isDebugEnabled) return;

    const log = this.formatLog('debug', message, data);
    console.debug(`[DEBUG] ${message}`, data || '');
  }

  /**
   * Info level logging
   */
  info(message: string, data?: any): void {
    const log = this.formatLog('info', message, data);
    console.info(`[INFO] ${message}`, data || '');
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any): void {
    const log = this.formatLog('warn', message, data);
    console.warn(`[WARN] ${message}`, data || '');
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | any): void {
    const log = this.formatLog('error', message, error);

    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, {
        message: error.message,
        stack: error.stack,
        ...(error.cause && { cause: error.cause }),
      });
    } else {
      console.error(`[ERROR] ${message}`, error || '');
    }
  }

  /**
   * Log API errors with additional context
   */
  apiError(endpoint: string, error: any, context?: any): void {
    this.error(`API Error: ${endpoint}`, {
      endpoint,
      error: error?.message || error,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: error?.response?.data,
      ...context,
    });
  }

  /**
   * Log API requests (debug level)
   */
  apiRequest(method: string, endpoint: string, data?: any): void {
    this.debug(`API Request: ${method} ${endpoint}`, data);
  }

  /**
   * Log API responses (debug level)
   */
  apiResponse(method: string, endpoint: string, status: number, data?: any): void {
    this.debug(`API Response: ${method} ${endpoint} ${status}`, data);
  }

  /**
   * Log component lifecycle events (debug level)
   */
  component(componentName: string, event: string, data?: any): void {
    this.debug(`[${componentName}] ${event}`, data);
  }

  /**
   * Log form validation errors
   */
  validation(formName: string, errors: any): void {
    this.warn(`Form Validation Error: ${formName}`, errors);
  }

  /**
   * Log user actions for analytics/debugging
   */
  userAction(action: string, data?: any): void {
    this.info(`User Action: ${action}`, data);
  }
}

// Export singleton instance
const logger = new Logger();

export default logger;

// Export convenience functions
export const logDebug = (message: string, data?: any) => logger.debug(message, data);
export const logInfo = (message: string, data?: any) => logger.info(message, data);
export const logWarn = (message: string, data?: any) => logger.warn(message, data);
export const logError = (message: string, error?: Error | any) => logger.error(message, error);
export const logApiError = (endpoint: string, error: any, context?: any) => logger.apiError(endpoint, error, context);
export const logApiRequest = (method: string, endpoint: string, data?: any) => logger.apiRequest(method, endpoint, data);
export const logApiResponse = (method: string, endpoint: string, status: number, data?: any) => logger.apiResponse(method, endpoint, status, data);
export const logComponent = (componentName: string, event: string, data?: any) => logger.component(componentName, event, data);
export const logValidation = (formName: string, errors: any) => logger.validation(formName, errors);
export const logUserAction = (action: string, data?: any) => logger.userAction(action, data);
