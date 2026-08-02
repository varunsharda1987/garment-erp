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

  minComponents: z.number().int().min(1, 'Min components must be at least 1').optional(),
  maxComponents: z.number().int().min(1, 'Max components must be at least 1').optional(),
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

  minComponents: z.number().int().min(1).optional(),
  maxComponents: z.number().int().min(1).optional(),
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
    .transform((val) => val.toLowerCase() === 'true')
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
 * Level parameter schema
 * For validating :level route parameters
 */
export const levelParamSchema = z.object({
  level: z.string().transform(Number).pipe(z.number().int().min(1).max(5)),
});

/**
 * Category component default parameter schema
 * For validating /:categoryId/default-components/:componentId routes
 */
export const categoryComponentParamSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID format'),
  componentId: z.string().uuid('Invalid component ID format'),
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

// ============================================================================
// CATEGORY COMPONENT DEFAULTS
// Persistence target: prisma model `category_component_defaults`
//   componentMasterId String (FK -> component_masters.id, uuid)
//   isRequired Boolean @default(false), sortOrder Int @default(0),
//   defaultCount Int @default(1), notes String?
// ============================================================================

/**
 * One default-component entry.
 * Mirrors `ComponentDefaultInput` in the service and the frontend type of the same name.
 */
export const componentDefaultInputSchema = z.object({
  componentMasterId: z.string().uuid('Invalid component master ID format'),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int('Sort order must be an integer').min(0, 'Sort order must be non-negative').optional(),
  defaultCount: z
    .number()
    .int('Default count must be an integer')
    .min(1, 'Default count must be at least 1')
    .optional(),
  notes: z.string().optional().nullable(),
});

/**
 * Set default components for a category (bulk replace)
 * POST /api/product-categories/:id/default-components
 *
 * `components` is optional (controller falls back to `[]`) and may legitimately be
 * an empty array — that is how the UI clears all defaults for a category.
 */
export const setDefaultComponentsSchema = z.object({
  components: z.array(componentDefaultInputSchema).optional(),
});

/**
 * Add a single default component to a category
 * POST /api/product-categories/:id/default-components/add
 */
export const addDefaultComponentSchema = componentDefaultInputSchema;

/**
 * Update a default component
 * PUT /api/product-categories/:categoryId/default-components/:componentId
 *
 * The controller forwards `req.body` wholesale to the service, which only reads
 * these four fields. `componentMasterId` is taken from the URL, not the body.
 */
export const updateDefaultComponentSchema = z.object({
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int('Sort order must be an integer').min(0, 'Sort order must be non-negative').optional(),
  defaultCount: z
    .number()
    .int('Default count must be an integer')
    .min(1, 'Default count must be at least 1')
    .optional(),
  notes: z.string().optional().nullable(),
});

// Type exports for TypeScript
export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;
export type ProductCategoryQueryInput = z.infer<typeof productCategoryQuerySchema>;
export type ProductCategoryIdParam = z.infer<typeof productCategoryIdParamSchema>;
export type LevelParam = z.infer<typeof levelParamSchema>;
export type CategoryComponentParam = z.infer<typeof categoryComponentParamSchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type ComponentDefaultInput = z.infer<typeof componentDefaultInputSchema>;
export type SetDefaultComponentsInput = z.infer<typeof setDefaultComponentsSchema>;
export type AddDefaultComponentInput = z.infer<typeof addDefaultComponentSchema>;
export type UpdateDefaultComponentInput = z.infer<typeof updateDefaultComponentSchema>;
