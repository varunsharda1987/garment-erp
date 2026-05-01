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
 * Field names match frontend GreigeMasterFormData
 */
export const createGreigeMasterSchema = z.object({
  greigeName: z.string().min(1, 'Greige name is required').max(200),
  greigeCode: z.string().max(50).optional(),
  genericGreigeName: z.string().max(200).optional(),
  yarnCount: z.string().max(50).optional(),
  construction: z.string().max(200).optional(),
  composition: z.string().min(1, 'Composition is required').max(500),
  weaveType: z.string().max(50).optional(),
  greigeQuality: z.enum(['PRINTING', 'DYEING', 'SUPER_DYEING']).optional().nullable(),
  weaver: z.string().max(200).optional(),
  greigeWidth: z.number().positive('Greige width is required'),
  defaultCutableWidth: z.number().positive().optional(),
  expectedFinishedWidthMin: z.number().positive().optional(),
  expectedFinishedWidthMax: z.number().positive().optional(),
  averageShrinkagePercent: z.number().min(0).max(100).optional().nullable(),
  gsmRange: z.string().max(50).optional(),
  costPerMeter: z.number().nonnegative().optional(),
  moq: z.number().positive().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  suppliers: z
    .array(
      z.object({
        supplierId: z.string().uuid(),
        isPreferred: z.boolean().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .optional(),
  description: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Greige Master
 * PUT /api/fabric-greige/greige/:id
 * Field names match frontend GreigeMasterFormData
 */
export const updateGreigeMasterSchema = z.object({
  greigeName: z.string().min(1).max(200).optional(),
  greigeCode: z.string().max(50).optional().nullable(),
  genericGreigeName: z.string().max(200).optional().nullable(),
  yarnCount: z.string().max(50).optional().nullable(),
  construction: z.string().max(200).optional().nullable(),
  composition: z.string().max(500).optional().nullable(),
  weaveType: z.string().max(50).optional().nullable(),
  greigeQuality: z.enum(['PRINTING', 'DYEING', 'SUPER_DYEING']).optional().nullable(),
  weaver: z.string().max(200).optional().nullable(),
  greigeWidth: z.number().positive().optional().nullable(),
  defaultCutableWidth: z.number().positive().optional().nullable(),
  expectedFinishedWidthMin: z.number().positive().optional().nullable(),
  expectedFinishedWidthMax: z.number().positive().optional().nullable(),
  averageShrinkagePercent: z.number().min(0).max(100).optional().nullable(),
  gsmRange: z.string().max(50).optional().nullable(),
  costPerMeter: z.number().nonnegative().optional().nullable(),
  moq: z.number().positive().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  suppliers: z
    .array(
      z.object({
        supplierId: z.string().uuid(),
        isPreferred: z.boolean().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .optional(),
  description: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Bulk Import Greige Masters
 * POST /api/fabric-greige/greige/bulk-import
 * Field names match frontend GreigeMasterFormData
 */
export const bulkImportGreigeSchema = z.object({
  greiges: z
    .array(
      z.object({
        greigeName: z.string().min(1).max(200),
        greigeCode: z.string().max(50).optional(),
        genericGreigeName: z.string().max(200).optional(),
        composition: z.string().min(1, 'Composition is required').max(500),
        greigeWidth: z.number().positive('Greige width is required'),
        defaultCutableWidth: z.number().positive('Default cutable width is required'),
        gsmRange: z.string().max(50).optional(),
        costPerMeter: z.number().nonnegative().optional(),
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
  composition: z.string().max(500).optional(),
  weaveType: z.string().max(50).optional(),
  isActive: z.string().optional(),
});

// ============================================================================
// FABRIC MASTER SCHEMAS
// ============================================================================

/**
 * Create Fabric Master
 * POST /api/fabric-greige/fabric
 * Field names match frontend FabricMasterFormData
 */
export const createFabricMasterSchema = z.object({
  fabricCode: z.string().min(1, 'Fabric code is required').max(50),
  fabricName: z.string().min(1, 'Fabric name is required').max(200),
  greigeId: z.string().uuid('Invalid greige ID').optional().nullable(),
  greigeName: z.string().max(200).optional().nullable(),
  genericGreigeName: z.string().max(200).optional().nullable(),
  yarnCount: z.string().max(50).optional().nullable(),
  composition: z.string().max(500).optional().nullable(),
  colorName: z.string().max(50).optional().nullable(),
  colorCode: z.string().max(20).optional().nullable(),
  finishType: z.string().max(50).optional().nullable(),
  printDesign: z.string().max(200).optional().nullable(),
  actualWidth: z.number().positive('Width must be positive'),
  cutableWidth: z.number().positive().optional().nullable(),
  finishedConstruction: z.string().max(200).optional().nullable(),
  actualGSM: z.number().positive().optional().nullable(),
  valueAddition: z.string().max(200).optional().nullable(),
  valueAdditionCost: z.number().nonnegative().optional().nullable(),
  styleReference: z.string().max(100).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  costPerMeter: z.number().nonnegative().optional().nullable(),
  moq: z.number().positive().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  suppliers: z
    .array(
      z.object({
        supplierId: z.string().uuid(),
        isPreferred: z.boolean().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .optional(),
  description: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isGeneric: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Fabric Master
 * PUT /api/fabric-greige/fabric/:id
 * Field names match frontend FabricMasterFormData
 */
export const updateFabricMasterSchema = z.object({
  fabricCode: z.string().max(50).optional(),
  fabricName: z.string().min(1).max(200).optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional().nullable(),
  greigeName: z.string().max(200).optional().nullable(),
  genericGreigeName: z.string().max(200).optional().nullable(),
  yarnCount: z.string().max(50).optional().nullable(),
  composition: z.string().max(500).optional().nullable(),
  colorName: z.string().max(50).optional().nullable(),
  colorCode: z.string().max(20).optional().nullable(),
  finishType: z.string().max(50).optional().nullable(),
  printDesign: z.string().max(200).optional().nullable(),
  actualWidth: z.number().positive().optional().nullable(),
  cutableWidth: z.number().positive().optional().nullable(),
  finishedConstruction: z.string().max(200).optional().nullable(),
  actualGSM: z.number().positive().optional().nullable(),
  valueAddition: z.string().max(200).optional().nullable(),
  valueAdditionCost: z.number().nonnegative().optional().nullable(),
  styleReference: z.string().max(100).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  costPerMeter: z.number().nonnegative().optional().nullable(),
  moq: z.number().positive().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  suppliers: z
    .array(
      z.object({
        supplierId: z.string().uuid(),
        isPreferred: z.boolean().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .optional(),
  description: z.string().max(1000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isGeneric: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Bulk Import Fabric Masters
 * POST /api/fabric-greige/fabric/bulk-import
 * Field names match frontend FabricMasterFormData
 */
export const bulkImportFabricSchema = z.object({
  fabrics: z
    .array(
      z.object({
        fabricName: z.string().min(1).max(200),
        fabricCode: z.string().max(50).optional(),
        genericGreigeName: z.string().max(200).optional(),
        greigeCode: z.string().max(50).optional(),
        greigeId: z.string().uuid().optional(),
        composition: z.string().max(500).optional(),
        colorName: z.string().max(50).optional(),
        colorCode: z.string().max(20).optional(),
        finishType: z.string().min(1, 'Finish type is required').max(50),
        actualWidth: z.number().positive('Actual width is required'),
        cutableWidth: z.number().positive().optional(),
        actualGSM: z.number().positive().optional(),
        costPerMeter: z.number().nonnegative().optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

/**
 * Allocate Fabric to Style
 * POST /api/fabric-greige/fabric/:id/allocate-to-style
 * Supports both single componentId (legacy) and componentIds array (multi-component)
 * Style is derived from component lookup in controller - not required in body
 */
export const allocateToStyleSchema = z
  .object({
    componentId: z.string().uuid('Invalid component ID').optional(),
    componentIds: z.array(z.string().uuid('Invalid component ID')).optional(),
    patternPartIds: z.array(z.string().uuid()).optional(),
    hasEmbroidery: z.boolean().optional(),
    // embroideryId accepts CUID (embroidery_master uses @default(cuid()))
    embroideryId: z
      .string()
      .refine(
        (val) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val),
        { message: 'Invalid embroidery ID (expected UUID or CUID)' }
      )
      .optional()
      .nullable(),
    notes: z.string().max(500).optional().nullable(),
  })
  .passthrough();

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
  colorName: z.string().max(50).optional(),
  finishType: z.string().max(50).optional(),
  isActive: z.string().optional(),
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
// Param Validation Schemas
// ============================================================================

export const greigeIdParamSchema = z.object({
  id: z.string().uuid('Invalid greige ID'),
});

export const fabricIdParamSchema = z.object({
  id: z.string().uuid('Invalid fabric ID'),
});

export const greigeIdRouteParamSchema = z.object({
  greigeId: z.string().uuid('Invalid greige ID'),
});

export const fabricIdRouteParamSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID'),
});

export const cadIdParamSchema = z.object({
  id: z.string().uuid('Invalid CAD ID'),
});

export const allocationIdParamSchema = z.object({
  id: z.string().uuid('Invalid fabric ID'),
  allocationId: z.string().uuid('Invalid allocation ID'),
});

export const styleFabricIdParamSchema = z.object({
  id: z.string().uuid('Invalid fabric ID'),
  styleFabricId: z.string().uuid('Invalid style fabric ID'),
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
