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
 *
 * Controller destructures:
 * - partName, partNumber, category, machine, brand, model, specifications
 * - pricePerUnit, supplierId, description, suppliers
 */
export const createMachinePartSchema = z
  .object({
    partName: z.string().max(200).optional(), // Auto-generated if not provided
    partNumber: z.string().max(50).optional(),
    category: z.string().max(50).optional(),
    machine: z.string().max(100).optional(),
    brand: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    specifications: z.string().max(1000).optional(),
    pricePerUnit: z.number().nonnegative().optional(),
    supplierId: z.string().uuid('Invalid supplier ID').optional(),
    description: z.string().max(500).optional(),
    suppliers: z
      .array(
        z.object({
          supplierId: z.string().uuid('Invalid supplier ID'),
          isPreferred: z.boolean().optional(),
          isActive: z.boolean().optional(),
          notes: z.string().max(500).optional(),
          pricePerUnit: z.union([z.number(), z.string()]).optional(),
        })
      )
      .optional(),
  })
  .passthrough();

/**
 * Update Machine Part
 * PUT /api/machine-parts/:id
 *
 * Controller destructures:
 * - partName, partNumber, category, machine, brand, model, specifications
 * - pricePerUnit, supplierId, description, isActive, suppliers
 */
export const updateMachinePartSchema = z
  .object({
    partName: z.string().min(1).max(200).optional(),
    partNumber: z.string().max(50).optional().nullable(),
    category: z.string().max(50).optional().nullable(),
    machine: z.string().max(100).optional().nullable(),
    brand: z.string().max(100).optional().nullable(),
    model: z.string().max(100).optional().nullable(),
    specifications: z.string().max(1000).optional().nullable(),
    pricePerUnit: z.number().nonnegative().optional().nullable(),
    supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
    suppliers: z
      .array(
        z.object({
          supplierId: z.string().uuid('Invalid supplier ID'),
          isPreferred: z.boolean().optional(),
          isActive: z.boolean().optional(),
          notes: z.string().max(500).optional(),
          pricePerUnit: z.union([z.number(), z.string()]).optional(),
        })
      )
      .optional(),
  })
  .passthrough();

/**
 * Bulk Import Machine Parts
 * POST /api/machine-parts/bulk-import
 *
 * Controller destructures: data, createStock
 * Each data row: partName, partNumber, category, machine, brand, model, specifications, pricePerUnit, description
 * Plus optional stock fields: stockQuantity, reorderLevel, maxLevel, locationCode
 */
export const bulkImportMachinePartsSchema = z
  .object({
    data: z
      .array(
        z
          .object({
            partName: z.string().min(1).max(200),
            partNumber: z.string().max(50).optional(),
            category: z.string().max(50).optional(),
            machine: z.string().max(100).optional(),
            brand: z.string().max(100).optional(),
            model: z.string().max(100).optional(),
            specifications: z.string().max(1000).optional(),
            pricePerUnit: z.number().nonnegative().optional(),
            description: z.string().max(500).optional(),
            stockQuantity: z.number().nonnegative().optional(),
            reorderLevel: z.number().nonnegative().optional(),
            maxLevel: z.number().nonnegative().optional(),
            locationCode: z.string().max(50).optional(),
          })
          .passthrough()
      )
      .min(1, 'At least one item is required'),
    createStock: z.boolean().optional().default(false),
  })
  .passthrough();

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
