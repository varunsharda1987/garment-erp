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
      // Validate query params. The COERCED result lives ONLY on req.validatedQuery.
      //
      // Under Express 5, `req.query` is a prototype getter that re-parses the URL on every access,
      // so the previous "copy the validated values back onto req.query" loop wrote to a throwaway
      // object and was silently discarded. It has been removed because it implied a guarantee that
      // did not hold. Do NOT reinstate it, and do NOT shadow req.query with the validated object:
      // controllers today correctly treat req.query as RAW STRINGS (e.g.
      // `req.query.isActive === 'true'` in productCategory.controller), so making coercion land
      // would silently invert those comparisons and break working filters.
      //
      // Rule for controllers: if you need the coerced/defaulted value, read
      //   (req as any).validatedQuery ?? req.query
      // Reading req.query directly gives you the raw string — which is fine as long as you convert
      // it yourself, as the existing controllers do.
      const validated = schema.parse(req.query) as Record<string, unknown>;
      req.validatedQuery = validated;
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
      req.validatedParams = validated;
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
