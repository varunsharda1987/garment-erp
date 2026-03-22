import { z } from 'zod';

/**
 * Create Size Category Schema
 * POST /api/size-categories
 */
export const createSizeCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
  sizes: z
    .array(z.string().min(1, 'Size value cannot be empty').trim())
    .min(1, 'At least one size is required'),
});

/**
 * Update Size Category Schema
 * PUT /api/size-categories/:id
 */
export const updateSizeCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
  sizes: z
    .array(z.string().min(1, 'Size value cannot be empty').trim())
    .min(1, 'At least one size is required')
    .optional(),
  isActive: z.boolean().optional(),
});

// Type exports for use in controllers
export type CreateSizeCategoryInput = z.infer<typeof createSizeCategorySchema>;
export type UpdateSizeCategoryInput = z.infer<typeof updateSizeCategorySchema>;
