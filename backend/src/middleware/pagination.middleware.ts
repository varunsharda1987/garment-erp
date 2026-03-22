/**
 * Pagination Middleware
 *
 * Standardizes pagination across all API endpoints by:
 * - Parsing and validating pagination parameters
 * - Setting defaults for missing values
 * - Attaching typed pagination object to request
 * - Providing utility functions for response formatting
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Pagination parameters attached to request
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  skip: number; // Alias for offset (Prisma uses skip)
  take: number; // Alias for limit (Prisma uses take)
}

/**
 * Standard paginated response format
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Configuration options for pagination
 */
export interface PaginationConfig {
  defaultLimit?: number;
  maxLimit?: number;
  defaultPage?: number;
}

// Default configuration
const defaultConfig: Required<PaginationConfig> = {
  defaultLimit: 10,
  maxLimit: 100,
  defaultPage: 1,
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
  }
}

/**
 * Middleware that parses pagination parameters from query string
 *
 * @param config - Optional configuration for defaults and limits
 *
 * @example
 * // Basic usage
 * router.get('/items', pagination(), getItems);
 *
 * @example
 * // With custom config
 * router.get('/items', pagination({ defaultLimit: 20, maxLimit: 50 }), getItems);
 *
 * @example
 * // In controller
 * const getItems = async (req, res) => {
 *   const { skip, take } = req.pagination;
 *   const items = await prisma.items.findMany({ skip, take });
 * };
 */
export const pagination = (config: PaginationConfig = {}) => {
  const { defaultLimit, maxLimit, defaultPage } = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Parse page number
    let page = parseInt(req.query.page as string, 10);
    if (isNaN(page) || page < 1) {
      page = defaultPage;
    }

    // Parse limit
    let limit = parseInt(req.query.limit as string, 10);
    if (isNaN(limit) || limit < 1) {
      limit = defaultLimit;
    }
    // Cap at maximum
    if (limit > maxLimit) {
      limit = maxLimit;
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Attach pagination params to request
    req.pagination = {
      page,
      limit,
      offset,
      skip: offset, // Prisma alias
      take: limit, // Prisma alias
    };

    next();
  };
};

/**
 * Format a paginated response
 *
 * @param data - Array of items
 * @param total - Total count of items (before pagination)
 * @param params - Pagination parameters from request
 *
 * @example
 * const items = await prisma.items.findMany({ skip, take });
 * const total = await prisma.items.count();
 * res.json(formatPaginatedResponse(items, total, req.pagination));
 */
export function formatPaginatedResponse<T>(data: T[], total: number, params: PaginationParams): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    },
  };
}

/**
 * Helper to get Prisma-compatible pagination args
 *
 * @param req - Express request with pagination attached
 * @returns Object with skip and take for Prisma queries
 *
 * @example
 * const items = await prisma.items.findMany({
 *   ...getPrismaArgs(req),
 *   where: { ... },
 *   orderBy: { ... },
 * });
 */
export function getPrismaArgs(req: Request): { skip: number; take: number } {
  if (!req.pagination) {
    return { skip: 0, take: 10 };
  }
  return {
    skip: req.pagination.skip,
    take: req.pagination.take,
  };
}

/**
 * Parse sort parameters from query string
 *
 * @param req - Express request
 * @param allowedFields - Array of field names that can be sorted
 * @param defaultField - Default field to sort by
 * @param defaultOrder - Default sort order
 *
 * @example
 * const orderBy = parseSortParams(req, ['name', 'createdAt'], 'createdAt', 'desc');
 * const items = await prisma.items.findMany({ orderBy });
 */
export function parseSortParams(
  req: Request,
  allowedFields: string[],
  defaultField: string = 'createdAt',
  defaultOrder: 'asc' | 'desc' = 'desc'
): Record<string, 'asc' | 'desc'> {
  const sortBy = req.query.sortBy as string;
  const sortOrder = (req.query.sortOrder as string)?.toLowerCase();

  // Validate field
  const field = allowedFields.includes(sortBy) ? sortBy : defaultField;

  // Validate order
  const order: 'asc' | 'desc' = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : defaultOrder;

  return { [field]: order };
}

export default pagination;
