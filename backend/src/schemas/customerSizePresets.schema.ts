/**
 * Customer Size Category Preset Validation Schemas
 *
 * Zod schemas for the customer size-category-preset endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * Persistence target: prisma model `customer_size_category_presets`
 *   presetName String, description String?, sizeCategoryId String (FK -> size_categories.id, uuid),
 *   isDefault Boolean @default(false), isActive Boolean @default(true)
 */

import { z } from 'zod';

/**
 * Create a size category preset
 * POST /api/customers/:customerId/size-category-presets
 */
export const createCustomerSizePresetSchema = z.object({
  presetName: z
    .string()
    .trim()
    .min(1, 'Preset name is required')
    .max(200, 'Preset name must not exceed 200 characters'),
  description: z.string().trim().optional().nullable(),
  sizeCategoryId: z.string().uuid('Invalid size category ID'),
  isDefault: z.boolean().optional(),
});

/**
 * Update a size category preset
 * PUT /api/customers/:customerId/size-category-presets/:presetId
 *
 * Every field is optional — the controller applies only what is present
 * (`...(presetName && { presetName })` etc.).
 */
export const updateCustomerSizePresetSchema = z.object({
  presetName: z
    .string()
    .trim()
    .min(1, 'Preset name cannot be empty')
    .max(200, 'Preset name must not exceed 200 characters')
    .optional(),
  description: z.string().trim().optional().nullable(),
  sizeCategoryId: z.string().uuid('Invalid size category ID').optional(),
  isActive: z.boolean().optional(),
});

/**
 * Clone a size category preset
 * POST /api/customers/:customerId/size-category-presets/:presetId/clone
 *
 * Only the new name is read from the body; description/sizeCategory are copied
 * from the source preset by the controller.
 */
export const cloneCustomerSizePresetSchema = z.object({
  presetName: z
    .string()
    .trim()
    .min(1, 'New preset name is required')
    .max(200, 'Preset name must not exceed 200 characters'),
});

// Type exports for use in controllers
export type CreateCustomerSizePresetInput = z.infer<typeof createCustomerSizePresetSchema>;
export type UpdateCustomerSizePresetInput = z.infer<typeof updateCustomerSizePresetSchema>;
export type CloneCustomerSizePresetInput = z.infer<typeof cloneCustomerSizePresetSchema>;
