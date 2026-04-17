/**
 * Fabric & Greige Master Validation Schemas
 *
 * Zod schemas for fabric master, greige master, and CAD endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// GREIGE MASTER SCHEMAS
// ============================================================================

/**
 * Create Greige Master
 * POST /api/fabric-greige/greige
 */
export const createGreigeMasterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().max(50).optional(),
  genericName: z.string().max(200).optional(),
  composition: z.string().max(500).optional(),
  construction: z.string().max(200).optional(),
  width: z.number().positive().optional(),
  gsm: z.number().positive().optional(),
  weaveType: z.string().max(50).optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  rate: z.number().nonnegative().optional(),
  unit: z.string().max(20).optional().default('METER'),
  hsnCode: z.string().max(20).optional(),
  moq: z.number().positive().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional().default(true),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Greige Master
 * PUT /api/fabric-greige/greige/:id
 */
export const updateGreigeMasterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional().nullable(),
  genericName: z.string().max(200).optional().nullable(),
  composition: z.string().max(500).optional().nullable(),
  construction: z.string().max(200).optional().nullable(),
  width: z.number().positive().optional().nullable(),
  gsm: z.number().positive().optional().nullable(),
  weaveType: z.string().max(50).optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  rate: z.number().nonnegative().optional().nullable(),
  unit: z.string().max(20).optional(),
  hsnCode: z.string().max(20).optional().nullable(),
  moq: z.number().positive().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Bulk Import Greige Masters
 * POST /api/fabric-greige/greige/bulk-import
 */
export const bulkImportGreigeSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        code: z.string().max(50).optional(),
        genericName: z.string().max(200).optional(),
        composition: z.string().max(500).optional(),
        width: z.number().positive().optional(),
        gsm: z.number().positive().optional(),
        rate: z.number().nonnegative().optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

/**
 * Greige Query Params
 * GET /api/fabric-greige/greige
 */
export const greigeQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  supplierId: z.string().uuid().optional(),
  genericName: z.string().max(200).optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// FABRIC MASTER SCHEMAS
// ============================================================================

/**
 * Create Fabric Master
 * POST /api/fabric-greige/fabric
 */
export const createFabricMasterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().max(50).optional(),
  genericName: z.string().max(200).optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  composition: z.string().max(500).optional(),
  construction: z.string().max(200).optional(),
  width: z.number().positive().optional(),
  gsm: z.number().positive().optional(),
  shrinkage: z.number().min(0).max(100).optional(),
  dyeType: z.string().max(50).optional(),
  finishType: z.string().max(50).optional(),
  colorId: z.string().uuid('Invalid color ID').optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  rate: z.number().nonnegative().optional(),
  unit: z.string().max(20).optional().default('METER'),
  hsnCode: z.string().max(20).optional(),
  moq: z.number().positive().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional().default(true),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Fabric Master
 * PUT /api/fabric-greige/fabric/:id
 */
export const updateFabricMasterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional().nullable(),
  genericName: z.string().max(200).optional().nullable(),
  greigeId: z.string().uuid('Invalid greige ID').optional().nullable(),
  composition: z.string().max(500).optional().nullable(),
  construction: z.string().max(200).optional().nullable(),
  width: z.number().positive().optional().nullable(),
  gsm: z.number().positive().optional().nullable(),
  shrinkage: z.number().min(0).max(100).optional().nullable(),
  dyeType: z.string().max(50).optional().nullable(),
  finishType: z.string().max(50).optional().nullable(),
  colorId: z.string().uuid('Invalid color ID').optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  rate: z.number().nonnegative().optional().nullable(),
  unit: z.string().max(20).optional(),
  hsnCode: z.string().max(20).optional().nullable(),
  moq: z.number().positive().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Bulk Import Fabric Masters
 * POST /api/fabric-greige/fabric/bulk-import
 */
export const bulkImportFabricSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        code: z.string().max(50).optional(),
        genericName: z.string().max(200).optional(),
        greigeCode: z.string().max(50).optional(),
        composition: z.string().max(500).optional(),
        width: z.number().positive().optional(),
        gsm: z.number().positive().optional(),
        rate: z.number().nonnegative().optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

/**
 * Allocate Fabric to Style
 * POST /api/fabric-greige/fabric/:id/allocate-to-style
 */
export const allocateToStyleSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  componentId: z.string().uuid('Invalid component ID').optional(),
  patternPartIds: z.array(z.string().uuid()).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Allocation Pattern Parts
 * PUT /api/fabric-greige/fabric/:id/allocations/:allocationId/pattern-parts
 */
export const updateAllocationPatternPartsSchema = z.object({
  patternPartIds: z.array(z.string().uuid()),
});

/**
 * Fabric Query Params
 * GET /api/fabric-greige/fabric
 */
export const fabricQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  supplierId: z.string().uuid().optional(),
  greigeId: z.string().uuid().optional(),
  genericName: z.string().max(200).optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// CAD SCHEMAS
// ============================================================================

/**
 * Create CAD Entry
 * POST /api/fabric-greige/cad
 */
export const createCADSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID'),
  greigeWidth: z.number().positive('Greige width is required'),
  cadValue: z.number().positive().optional(),
  shrinkage: z.number().min(0).max(50).optional(),
  wastage: z.number().min(0).max(50).optional(),
  isPreferred: z.boolean().optional().default(false),
  remarks: z.string().max(500).optional(),
});

/**
 * Update CAD Entry
 * PUT /api/fabric-greige/cad/:id
 */
export const updateCADSchema = z.object({
  greigeWidth: z.number().positive().optional(),
  cadValue: z.number().positive().optional(),
  shrinkage: z.number().min(0).max(50).optional(),
  wastage: z.number().min(0).max(50).optional(),
  isPreferred: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Set Preferred Width
 * PATCH /api/fabric-greige/cad/:id/set-preferred
 */
export const setPreferredWidthSchema = z.object({
  isPreferred: z.literal(true),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateGreigeMasterInput = z.infer<typeof createGreigeMasterSchema>;
export type UpdateGreigeMasterInput = z.infer<typeof updateGreigeMasterSchema>;
export type BulkImportGreigeInput = z.infer<typeof bulkImportGreigeSchema>;
export type GreigeQueryInput = z.infer<typeof greigeQuerySchema>;

export type CreateFabricMasterInput = z.infer<typeof createFabricMasterSchema>;
export type UpdateFabricMasterInput = z.infer<typeof updateFabricMasterSchema>;
export type BulkImportFabricInput = z.infer<typeof bulkImportFabricSchema>;
export type AllocateToStyleInput = z.infer<typeof allocateToStyleSchema>;
export type UpdateAllocationPatternPartsInput = z.infer<typeof updateAllocationPatternPartsSchema>;
export type FabricQueryInput = z.infer<typeof fabricQuerySchema>;

export type CreateCADInput = z.infer<typeof createCADSchema>;
export type UpdateCADInput = z.infer<typeof updateCADSchema>;
export type SetPreferredWidthInput = z.infer<typeof setPreferredWidthSchema>;
