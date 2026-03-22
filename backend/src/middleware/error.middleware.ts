/**
 * Global Error Handler Middleware
 * Centralized error handling for consistent API responses
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors';
import { logError, logWarn } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Standard error response format
 */
interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
}

/**
 * Generate a unique request ID for tracking
 */
const generateRequestId = (): string => {
  return uuidv4();
};

/**
 * Map Prisma error codes to user-friendly messages
 */
const handlePrismaError = (
  error: Prisma.PrismaClientKnownRequestError,
  requestId: string
): ErrorResponse => {
  switch (error.code) {
    case 'P2002': {
      // Unique constraint violation
      const target = (error.meta?.target as string[])?.join(', ') || 'field';
      return {
        error: 'CONFLICT',
        message: `A record with this ${target} already exists`,
        requestId,
        timestamp: new Date().toISOString(),
      };
    }
    case 'P2003': {
      // Foreign key constraint violation
      return {
        error: 'VALIDATION_ERROR',
        message: 'Referenced record does not exist',
        requestId,
        timestamp: new Date().toISOString(),
      };
    }
    case 'P2025': {
      // Record not found
      return {
        error: 'NOT_FOUND',
        message: 'The requested record was not found',
        requestId,
        timestamp: new Date().toISOString(),
      };
    }
    case 'P2014': {
      // Required relation violation
      return {
        error: 'VALIDATION_ERROR',
        message: 'The change would violate a required relation',
        requestId,
        timestamp: new Date().toISOString(),
      };
    }
    default:
      return {
        error: 'DATABASE_ERROR',
        message: 'A database error occurred',
        details: process.env.NODE_ENV === 'development' ? { code: error.code } : undefined,
        requestId,
        timestamp: new Date().toISOString(),
      };
  }
};

/**
 * Handle Zod validation errors
 */
const handleZodError = (error: ZodError, requestId: string): ErrorResponse => {
  const details = error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

  return {
    error: 'VALIDATION_ERROR',
    message: 'Invalid request data',
    details,
    requestId,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Global error handler middleware
 * Should be registered as the last middleware in the Express app
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Generate or use existing request ID
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

  // Log error with context
  const errorContext = {
    requestId,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    user: req.user?.userId,
  };

  // Handle known operational errors (AppError)
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logError(`[${requestId}] ${error.message}`, { ...errorContext, stack: error.stack });
    } else {
      logWarn(`[${requestId}] ${error.message}`, errorContext);
    }

    const response: ErrorResponse = {
      error: error.code,
      message: error.message,
      details: error.details,
      requestId,
      timestamp: new Date().toISOString(),
    };

    res.status(error.statusCode).json(response);
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    logWarn(`[${requestId}] Validation error`, { ...errorContext, issues: error.issues });
    res.status(400).json(handleZodError(error, requestId));
    return;
  }

  // Handle Prisma known request errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaResponse = handlePrismaError(error, requestId);
    const statusCode = prismaResponse.error === 'NOT_FOUND' ? 404 :
                       prismaResponse.error === 'CONFLICT' ? 409 : 400;

    if (statusCode >= 500) {
      logError(`[${requestId}] Prisma error: ${error.code}`, { ...errorContext, stack: error.stack });
    } else {
      logWarn(`[${requestId}] Prisma error: ${error.code}`, errorContext);
    }

    res.status(statusCode).json(prismaResponse);
    return;
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    logWarn(`[${requestId}] Prisma validation error`, errorContext);
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid data provided to database',
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle unknown/unexpected errors
  logError(`[${requestId}] Unhandled error: ${error.message}`, {
    ...errorContext,
    stack: error.stack,
    name: error.name,
  });

  // Don't expose internal error details in production
  const message = process.env.NODE_ENV === 'development'
    ? error.message
    : 'An unexpected error occurred';

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message,
    requestId,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Not found handler middleware
 * Handles requests to undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    requestId,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass them to the error middleware
 * @example router.get('/users', asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler = (
  fn: ((req: Request, res: Response, next: NextFunction) => Promise<any>) | ((req: Request, res: Response) => Promise<any>)
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve((fn as any)(req, res, next)).catch(next);
  };
};
