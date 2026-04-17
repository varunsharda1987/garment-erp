/**
 * Style Image Validation Schemas
 *
 * Zod schemas for style gallery functionality.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ImageTypeEnum = z.enum([
  'MAIN',
  'FRONT',
  'BACK',
  'DETAIL',
  'FLAT',
  'SKETCH',
  'TECH_PACK',
  'SAMPLE',
  'OTHER',
]);

// ============================================================================
// STYLE IMAGE SCHEMAS
// ============================================================================

/**
 * Update Image
 * PATCH /api/styles/:styleId/images/:imageId
 */
export const updateImageSchema = z.object({
  imageType: ImageTypeEnum.optional(),
  caption: z.string().max(200).optional().nullable(),
  isMain: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

/**
 * Reorder Images
 * POST /api/styles/:styleId/images/reorder
 */
export const reorderImagesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1, 'At least one image ID is required'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UpdateImageInput = z.infer<typeof updateImageSchema>;
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;
