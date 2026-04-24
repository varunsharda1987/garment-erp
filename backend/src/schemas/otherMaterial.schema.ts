/**
 * Other Material Validation Schemas
 *
 * Zod schemas for other material master endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// OTHER MATERIAL SCHEMAS
// ============================================================================

/**
 * Bulk Import Other Materials
 * POST /api/materials/other-material/bulk-import
 */
export const bulkImportOtherMaterialSchema = z.object({
  data: z
    .array(
      z.object({
        materialName: z.string().min(1, 'Material name is required').max(200),
        category: z.string().max(100).optional(),
        unit: z.string().max(20).optional().default('PIECE'),
        specifications: z.string().max(500).optional(),
        pricePerUnit: z.number().nonnegative().optional(),
        description: z.string().max(1000).optional(),
        stockQuantity: z.number().nonnegative().optional(),
        reorderLevel: z.number().nonnegative().optional(),
        maxLevel: z.number().nonnegative().optional(),
        locationCode: z.string().max(50).optional(),
      })
    )
    .min(1, 'At least one item is required'),
  createStock: z.boolean().optional().default(false),
});

// ============================================================================
// Type Exports
// ============================================================================

export type BulkImportOtherMaterialInput = z.infer<typeof bulkImportOtherMaterialSchema>;
