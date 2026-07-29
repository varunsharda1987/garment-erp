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
 * Supplier link for an other material (junction row).
 * pricePerUnit is coerced because the controller runs parseFloat(String(...)) on it.
 */
const otherMaterialSupplierSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  isPreferred: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
  pricePerUnit: z.coerce.number().nonnegative().optional().nullable(),
});

/**
 * Create Other Material
 * POST /api/materials/other-material
 * `suppliers` defaults to [] so the controller's suppliers.map() can never hit a non-array (500 → 400).
 */
export const createOtherMaterialSchema = z.object({
  materialName: z.string().min(1, 'Material name is required').max(200),
  category: z.string().max(100).optional().nullable(),
  unit: z.string().max(20).optional(),
  specifications: z.string().max(500).optional().nullable(),
  pricePerUnit: z.coerce.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  suppliers: z.array(otherMaterialSupplierSchema).optional().default([]),
});

/**
 * Update Other Material
 * PUT /api/materials/other-material/:id
 * All fields optional; `suppliers`, when present, MUST be an array (delete-and-recreate).
 */
export const updateOtherMaterialSchema = z.object({
  materialName: z.string().min(1).max(200).optional(),
  category: z.string().max(100).optional().nullable(),
  unit: z.string().max(20).optional(),
  specifications: z.string().max(500).optional().nullable(),
  pricePerUnit: z.coerce.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  suppliers: z.array(otherMaterialSupplierSchema).optional(),
});

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
export type CreateOtherMaterialInput = z.infer<typeof createOtherMaterialSchema>;
export type UpdateOtherMaterialInput = z.infer<typeof updateOtherMaterialSchema>;
