/**
 * Validation Middleware
 * Provides Zod-based request validation for Express routes
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { logDebug, logWarn } from '../utils/logger';

/**
 * Formats Zod validation errors into a user-friendly format
 * Compatible with Zod v4
 */
const formatZodErrors = (error: z.ZodError): { field: string; message: string }[] => {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
};

/**
 * Creates a validation middleware for request body
 * @param schema - Zod schema to validate against
 */
export const validateBody = <T extends ZodSchema>(schema: T) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        logWarn(`Validation failed for ${req.method} ${req.path}:`);
        logWarn(`  Errors: ${JSON.stringify(details)}`);
        logWarn(`  Body keys: ${Object.keys(req.body || {}).join(', ')}`);
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details,
        });
      }
      next(error);
    }
  };
};

/**
 * Creates a validation middleware for query parameters
 * @param schema - Zod schema to validate against
 */
export const validateQuery = <T extends ZodSchema>(schema: T) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate query params - store result in req.validatedQuery since req.query is read-only
      const validated = schema.parse(req.query) as Record<string, unknown>;
      (req as any).validatedQuery = validated;
      // Also copy validated values back to query object properties
      Object.keys(validated).forEach((key) => {
        (req.query as Record<string, unknown>)[key] = validated[key];
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: formatZodErrors(error),
        });
      }
      next(error);
    }
  };
};

/**
 * Creates a validation middleware for URL parameters
 * @param schema - Zod schema to validate against
 */
export const validateParams = <T extends ZodSchema>(schema: T) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate params - store result in req.validatedParams since req.params is read-only
      const validated = schema.parse(req.params) as Record<string, unknown>;
      (req as any).validatedParams = validated;
      // Also copy validated values back to params object properties
      Object.keys(validated).forEach((key) => {
        (req.params as Record<string, unknown>)[key] = validated[key];
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid URL parameters',
          details: formatZodErrors(error),
        });
      }
      next(error);
    }
  };
};

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid ID format'),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),

  // Search with pagination
  searchWithPagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional().default(''),
  }),

  // ID param
  idParam: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),
};
