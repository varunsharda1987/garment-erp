/**
 * Machine Part Validation Schemas
 *
 * Zod schemas for machine part CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// MACHINE PART SCHEMAS
// ============================================================================

/**
 * Create Machine Part
 * POST /api/machine-parts
 */
export const createMachinePartSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().max(50).optional(),
  partNumber: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  machineType: z.string().max(100).optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  unit: z.string().max(20).optional().default('PCS'),
  price: z.number().nonnegative().optional(),
  minStock: z.number().int().nonnegative().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional().default(true),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Machine Part
 * PUT /api/machine-parts/:id
 */
export const updateMachinePartSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional().nullable(),
  partNumber: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  machineType: z.string().max(100).optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  unit: z.string().max(20).optional(),
  price: z.number().nonnegative().optional().nullable(),
  minStock: z.number().int().nonnegative().optional().nullable(),
  reorderLevel: z.number().int().nonnegative().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Bulk Import Machine Parts
 * POST /api/machine-parts/bulk-import
 */
export const bulkImportMachinePartsSchema = z.object({
  data: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        code: z.string().max(50).optional(),
        partNumber: z.string().max(50).optional(),
        description: z.string().max(500).optional(),
        category: z.string().max(50).optional(),
        machineType: z.string().max(100).optional(),
        price: z.number().nonnegative().optional(),
      })
    )
    .min(1, 'At least one item is required'),
  createStock: z.boolean().optional().default(false),
});

/**
 * Machine Part Query Params
 * GET /api/machine-parts
 */
export const machinePartQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  machineType: z.string().max(100).optional(),
  supplierId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateMachinePartInput = z.infer<typeof createMachinePartSchema>;
export type UpdateMachinePartInput = z.infer<typeof updateMachinePartSchema>;
export type BulkImportMachinePartsInput = z.infer<typeof bulkImportMachinePartsSchema>;
export type MachinePartQueryInput = z.infer<typeof machinePartQuerySchema>;
