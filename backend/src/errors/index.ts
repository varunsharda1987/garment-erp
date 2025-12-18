/**
 * Custom Error Classes
 * Provides typed error handling with proper HTTP status codes
 */

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Operational errors are expected and handled

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 400 Bad Request - Validation errors
 * Use when request data fails validation
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/**
 * 401 Unauthorized - Authentication errors
 * Use when user is not authenticated
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

/**
 * 403 Forbidden - Authorization errors
 * Use when user doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(403, 'FORBIDDEN', message);
  }
}

/**
 * 404 Not Found - Resource not found errors
 * Use when requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(404, 'NOT_FOUND', message);
  }
}

/**
 * 409 Conflict - Resource conflict errors
 * Use when resource already exists or conflicts with existing data
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, 'CONFLICT', message, details);
  }
}

/**
 * 422 Unprocessable Entity - Business logic errors
 * Use when request is valid but business rules prevent processing
 */
export class BusinessError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(422, 'BUSINESS_ERROR', message, details);
  }
}

/**
 * 429 Too Many Requests - Rate limiting errors
 * Use when user exceeds rate limits
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
  }
}

/**
 * 500 Internal Server Error - Unexpected errors
 * Use for unexpected server errors (use sparingly, prefer specific errors)
 */
export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super(500, 'INTERNAL_ERROR', message);
  }
}

/**
 * 503 Service Unavailable - Service dependency errors
 * Use when external service is unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(503, 'SERVICE_UNAVAILABLE', `${service} is currently unavailable`);
  }
}

/**
 * Database error - wraps Prisma errors
 * Use to wrap database-specific errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(500, 'DATABASE_ERROR', message, details);
  }
}
