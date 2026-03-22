import { z } from 'zod';

/**
 * Create Cost Center Schema
 * POST /api/cost-centers
 */
export const createCostCenterSchema = z.object({
  costCenterCode: z
    .string()
    .min(1, 'Cost center code is required')
    .max(50, 'Cost center code must not exceed 50 characters')
    .trim(),
  costCenterName: z
    .string()
    .min(1, 'Cost center name is required')
    .max(200, 'Cost center name must not exceed 200 characters')
    .trim(),
  costCenterType: z
    .string()
    .min(1, 'Cost center type is required')
    .max(100, 'Cost center type must not exceed 100 characters')
    .trim(),
  departmentId: z.string().uuid('Invalid department ID format').optional().nullable(),
  locationId: z.string().uuid('Invalid location ID format').optional().nullable(),
  budgetAmount: z
    .number()
    .nonnegative('Budget amount must be non-negative')
    .optional()
    .nullable(),
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Cost Center Schema
 * PUT /api/cost-centers/:id
 */
export const updateCostCenterSchema = z.object({
  costCenterCode: z
    .string()
    .min(1, 'Cost center code is required')
    .max(50, 'Cost center code must not exceed 50 characters')
    .trim()
    .optional(),
  costCenterName: z
    .string()
    .min(1, 'Cost center name is required')
    .max(200, 'Cost center name must not exceed 200 characters')
    .trim()
    .optional(),
  costCenterType: z
    .string()
    .min(1, 'Cost center type is required')
    .max(100, 'Cost center type must not exceed 100 characters')
    .trim()
    .optional(),
  departmentId: z.string().uuid('Invalid department ID format').optional().nullable(),
  locationId: z.string().uuid('Invalid location ID format').optional().nullable(),
  budgetAmount: z
    .number()
    .nonnegative('Budget amount must be non-negative')
    .optional()
    .nullable(),
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Cost Center Query Schema
 * GET /api/cost-centers
 */
export const costCenterQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(1000, 'Limit must not exceed 1000')),
  search: z.string().trim().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true';
    })
    .pipe(z.boolean().optional()),
  sortBy: z
    .enum(['costCenterCode', 'costCenterName', 'costCenterType', 'createdAt'])
    .optional()
    .default('costCenterCode'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Type exports
export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;
export type UpdateCostCenterInput = z.infer<typeof updateCostCenterSchema>;
export type CostCenterQueryInput = z.infer<typeof costCenterQuerySchema>;
