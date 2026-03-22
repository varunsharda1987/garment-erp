/**
 * Product Category Validation Schemas
 * Zod schemas for validating product category-related requests
 */

import { z } from 'zod';

/**
 * Create product category request schema
 * POST /api/product-categories
 */
export const createProductCategorySchema = z.object({
  code: z
    .string()
    .min(1, 'Category code is required')
    .max(20, 'Category code must be less than 20 characters')
    .trim()
    .toUpperCase(),

  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name must be less than 100 characters')
    .trim(),

  description: z.string().max(500, 'Description must be less than 500 characters').trim().optional().nullable(),

  parentId: z.string().uuid('Invalid parent category ID format').optional().nullable(),

  level: z
    .number()
    .int('Level must be an integer')
    .min(1, 'Level must be at least 1')
    .max(5, 'Level must be at most 5')
    .optional(),

  sortOrder: z
    .number()
    .int('Sort order must be an integer')
    .min(0, 'Sort order must be non-negative')
    .optional()
    .default(0),
});

/**
 * Update product category request schema
 * PUT /api/product-categories/:id
 */
export const updateProductCategorySchema = z.object({
  code: z
    .string()
    .min(1, 'Category code is required')
    .max(20, 'Category code must be less than 20 characters')
    .trim()
    .toUpperCase()
    .optional(),

  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name must be less than 100 characters')
    .trim()
    .optional(),

  description: z.string().max(500, 'Description must be less than 500 characters').trim().optional().nullable(),

  parentId: z.string().uuid('Invalid parent category ID format').optional().nullable(),

  level: z
    .number()
    .int('Level must be an integer')
    .min(1, 'Level must be at least 1')
    .max(5, 'Level must be at most 5')
    .optional(),

  sortOrder: z.number().int('Sort order must be an integer').min(0, 'Sort order must be non-negative').optional(),

  isActive: z.boolean().optional(),
});

/**
 * Product category query parameters schema
 * GET /api/product-categories
 */
export const productCategoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),

  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),

  search: z.string().optional(),

  parentId: z
    .string()
    .uuid('Invalid parent category ID format')
    .optional()
    .nullable()
    .or(z.literal('null').transform(() => null)),

  level: z.coerce.number().int().min(1).max(5).optional(),

  isActive: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional(),

  sortBy: z.string().optional(),

  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Product category ID parameter schema
 * For validating :id route parameters
 */
export const productCategoryIdParamSchema = z.object({
  id: z.string().uuid('Invalid product category ID format'),
});

/**
 * Reorder categories schema
 * POST /api/product-categories/reorder
 */
export const reorderCategoriesSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().uuid('Invalid category ID format'),
      sortOrder: z.number().int().min(0),
    })
  ),
});

// Type exports for TypeScript
export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;
export type ProductCategoryQueryInput = z.infer<typeof productCategoryQuerySchema>;
export type ProductCategoryIdParam = z.infer<typeof productCategoryIdParamSchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
