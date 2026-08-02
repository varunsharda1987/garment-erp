import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Tell winston about the colors
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format (colorized for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define which transports to use
const transports = [
  // Console transport - always enabled
  new winston.transports.Console({
    format: consoleFormat,
  }),

  // File transports - write all logs
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format,
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

/**
 * Metadata type for log messages
 */
export type LogMeta = Record<string, unknown>;

/**
 * Converts various data types to LogMeta format
 */
const toMeta = (data?: unknown): LogMeta | undefined => {
  if (data === undefined) return undefined;
  if (data === null) return { value: null };
  if (typeof data === 'object' && !Array.isArray(data)) return data as LogMeta;
  return { value: data };
};

// Helper functions for common logging patterns
export const logInfo = (message: string, meta?: unknown): void => {
  logger.info(message, toMeta(meta));
};

// BUG-PROC4 fix: Enhanced logError to support additional context metadata
export const logError = (message: string, error?: Error | unknown, context?: LogMeta): void => {
  if (error instanceof Error) {
    logger.error(message, { error: error.message, stack: error.stack, ...context });
  } else if (context) {
    // When error is not an Error instance but context is provided
    logger.error(message, { ...toMeta(error), ...context });
  } else {
    logger.error(message, toMeta(error));
  }
};

export const logWarn = (message: string, meta?: unknown): void => {
  logger.warn(message, toMeta(meta));
};

export const logDebug = (message: string, meta?: unknown): void => {
  logger.debug(message, toMeta(meta));
};

export const logHttp = (message: string, meta?: unknown): void => {
  logger.http(message, toMeta(meta));
};

// Export logger instance for direct use
export default logger;
