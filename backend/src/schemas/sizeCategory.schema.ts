import { z } from 'zod';

/**
 * Query Schema for Size Categories
 * GET /api/size-categories
 * BUG-MM7 fix: added validation
 */
export const sizeCategoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

/**
 * Create Size Category Schema
 * POST /api/size-categories
 */
export const createSizeCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must not exceed 100 characters').trim(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  sizes: z.array(z.string().min(1, 'Size value cannot be empty').trim()).min(1, 'At least one size is required'),
});

/**
 * Update Size Category Schema
 * PUT /api/size-categories/:id
 */
export const updateSizeCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must not exceed 100 characters').trim().optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  sizes: z
    .array(z.string().min(1, 'Size value cannot be empty').trim())
    .min(1, 'At least one size is required')
    .optional(),
  isActive: z.boolean().optional(),
});

// Type exports for use in controllers
export type SizeCategoryQueryInput = z.infer<typeof sizeCategoryQuerySchema>;
export type CreateSizeCategoryInput = z.infer<typeof createSizeCategorySchema>;
export type UpdateSizeCategoryInput = z.infer<typeof updateSizeCategorySchema>;
