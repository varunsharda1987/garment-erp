/**
 * CAD Planning Module Validation Schemas
 *
 * Zod schemas for CAD planning, calculation, and approval endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const CADPurposeEnum = z.enum(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION']);

// BUG-CAD12 fix: Added ALTERNATE_APPROVED to match Prisma enum
export const CADApprovalStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALTERNATE_APPROVED']);

export const VarianceActionEnum = z.enum(['APPROVE', 'REJECT']);

// BUG-CAD10 fix: added Zod enum for type safety
export const VarianceApprovalStatusEnum = z.enum(['NOT_REQUIRED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']);

// BUG-CAD10 fix: added Zod enum for type safety
export const GreigeRateSourceEnum = z.enum(['PROCUREMENT', 'STOCK_VALUATION', 'GREIGE_MASTER', 'MANUAL_OVERRIDE']);

// ============================================================================
// CAD GENERATION & CALCULATION
// ============================================================================

/**
 * Generate CAD Options
 * POST /api/cad-planning/generate
 */
export const generateCADOptionsSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  greigeWidths: z.array(z.number().positive()).optional(),
  includeAllWidths: z.boolean().optional().default(false),
  genericGreigeName: z.string().max(200).optional(),
  averagingMode: z.enum(['COMBINED', 'SEPARATE']).optional(),
  componentNames: z.array(z.string()).optional(),
});

/**
 * Calculate CAD Cost
 * POST /api/cad-planning/calculate-cost
 */
export const calculateCADCostSchema = z.object({
  // Not read by calculateCADCost (it uses cadId/fabricRate/unit) — optional so a valid call is not rejected.
  styleId: z.string().uuid('Invalid style ID').optional(),
  cadId: z.string().uuid('Invalid CAD ID').optional(),
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  greigeWidth: z.number().positive().optional(),
  cadValue: z.number().positive().optional(),
  quantity: z.number().positive().optional(),
  fabricRate: z.number().nonnegative().optional(),
  unit: z.string().max(50).optional(),
});

/**
 * Select Greige for Group
 * POST /api/cad-planning/:styleId/select-greige
 */
export const selectGreigeForGroupSchema = z
  .object({
    fabricGroupKey: z.string().max(100).optional(),
    groupKey: z.string().max(100).optional(),
    greigeId: z.string().uuid('Invalid greige ID'),
    genericGreigeName: z.string().max(200).optional(),
    averagingMode: z.enum(['COMBINED', 'SEPARATE']).optional(),
  })
  // BUG-CAD9 fix: normalize fabricGroupKey to groupKey
  .transform((data) => ({
    ...data,
    groupKey: data.groupKey ?? data.fabricGroupKey,
  }));

// ============================================================================
// CAD ROW OPERATIONS
// ============================================================================

/**
 * Add CAD Table Row
 * POST /api/cad-planning/:styleId/row
 * Creates a new CAD row for a style fabric. Width is determined from stock (PRODUCTION)
 * or set later via update (COSTING/RAW_MATERIAL_CALCULATION).
 */
export const addCADTableRowSchema = z.object({
  styleFabricId: z.string().uuid('Invalid style fabric ID'),
  componentId: z.string().optional(), // Derived from styleFabricId on backend if not provided
  partId: z.string().uuid('Invalid part ID').optional(),
  partIds: z.array(z.string().uuid()).optional(), // Multi-part selection
  purpose: CADPurposeEnum.optional().default('COSTING'),
  fabricStockId: z.string().uuid('Invalid fabric stock ID').optional(), // Required for PRODUCTION purpose
});

/**
 * Add Combined CAD Row
 * POST /api/cad-planning/:styleId/combined-row
 * Creates a CAD row combining multiple style fabrics (e.g., combined cutting).
 */
export const addCombinedCADRowSchema = z.object({
  styleFabricIds: z.array(z.string().uuid()).min(1, 'At least one style fabric is required'),
  purpose: CADPurposeEnum.optional().default('COSTING'),
  fabricStockId: z.string().uuid('Invalid fabric stock ID').optional(), // Required for PRODUCTION purpose
});

/**
 * Update CAD Table Row
 * PUT /api/cad-planning/:styleId/row/:rowId
 * Updates CAD row values including width, greige selection, size breakdowns, etc.
 */
export const updateCADTableRowSchema = z.object({
  // Purpose and part selection
  purpose: CADPurposeEnum.optional(),
  partId: z.string().uuid('Invalid part ID').optional().nullable(),
  partIds: z.array(z.string().uuid()).optional(), // Multi-part selection
  isEmbroidery: z.boolean().optional(),
  // Greige/Fabric selection
  greigeId: z.string().uuid('Invalid greige ID').optional().nullable(),
  fabricId: z.string().uuid('Invalid fabric ID').optional().nullable(), // Ready fabric mode
  // Width and measurements
  cutableWidth: z.number().positive().optional().nullable(),
  printDirection: z.string().max(50).optional().nullable(),
  // CAD calculations
  cadMeters: z.number().nonnegative().optional().nullable(), // Layer length
  layerLengthMeters: z.number().nonnegative().optional().nullable(), // Alias for cadMeters
  piecesPerMarker: z.number().int().positive().optional().nullable(),
  markerEfficiency: z.number().min(0).max(100).optional().nullable(),
  cadWastagePercent: z.number().min(0).max(100).optional().nullable(),
  layerMarginMeters: z.number().nonnegative().optional().nullable(),
  // Size breakdown
  sizeBreakdowns: z
    .array(
      z.object({
        sizeName: z.string(),
        quantity: z.number().nonnegative(),
      })
    )
    .optional()
    .nullable(),
  // Notes
  notes: z.string().max(500).optional().nullable(),
});

/**
 * Add CAD Width (Legacy)
 * POST /api/cad-planning/:styleId/add-width
 */
export const addCADWidthSchema = z
  .object({
    fabricGroupKey: z.string().max(100).optional(),
    groupKey: z.string().max(100).optional(),
    greigeId: z.string().uuid('Invalid greige ID'),
    greigeWidth: z.number().positive().optional(),
    fabricId: z.string().uuid('Invalid fabric ID').optional(),
    cutableWidth: z.number().positive().optional(),
    componentName: z.string().max(200).optional(),
    // Real PrintDirection column the controller reads; stripped here, so it always fell back to the
    // TWO_WAY default and a ONE_WAY selection was silently lost.
    printDirection: z.enum(['ONE_WAY', 'TWO_WAY']).optional(),
  })
  // BUG-CAD9 fix: normalize fabricGroupKey to groupKey
  .transform((data) => ({
    ...data,
    groupKey: data.groupKey ?? data.fabricGroupKey,
  }));

/**
 * Update CAD Values with Breakdown
 * PUT /api/cad-planning/cad/:cadId
 */
export const updateCADValuesWithBreakdownSchema = z.object({
  cadValue: z.number().positive().optional(),
  sizeBreakdown: z.record(z.string(), z.number().nonnegative()).optional(),
  remarks: z.string().max(500).optional().nullable(),
  // Additional CAD measurement fields
  cutableWidth: z.number().positive().optional(),
  cadMeters: z.number().nonnegative().optional(),
  cadYards: z.number().nonnegative().optional(),
  cadWastagePercent: z.number().min(0).max(100).optional(),
  layerMarginMeters: z.number().nonnegative().optional(),
  markerLengthMeters: z.number().positive().optional(),
  piecesPerMarker: z.number().int().positive().optional(),
  processingPricePerMeter: z.number().nonnegative().optional(),
  markerEfficiency: z.number().min(0).max(100).optional(),
  markerPlanFile: z.string().max(500).optional().nullable(),
  supplierAvailability: z.string().max(200).optional().nullable(),
  priceDifferential: z.number().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isPreferred: z.boolean().optional(),
  printDirection: z.string().max(50).optional().nullable(),
  sizeBreakdowns: z
    .array(
      z.object({
        sizeName: z.string(),
        quantity: z.number().nonnegative(),
      })
    )
    .optional(),
});

/**
 * Update CAD Values (Legacy)
 * PUT /api/cad-planning/update-cad/:cadId
 */
export const updateCADValuesSchema = z.object({
  cadValue: z.number().positive().optional(),
  shrinkage: z.number().min(0).max(50).optional(),
  wastage: z.number().min(0).max(50).optional(),
  remarks: z.string().max(500).optional().nullable(),
  cutableWidth: z.number().positive().optional(),
  cadMeters: z.number().nonnegative().optional(),
  cadYards: z.number().nonnegative().optional(),
  cadWastagePercent: z.number().min(0).max(100).optional(),
  layerMarginMeters: z.number().nonnegative().optional(),
  piecesPerMarker: z.number().int().positive().optional(),
  markerLengthMeters: z.number().positive().optional(),
  processingPricePerMeter: z.number().nonnegative().optional(),
  markerEfficiency: z.number().min(0).max(100).optional(),
  markerPlanFile: z.string().max(500).optional().nullable(),
  supplierAvailability: z.string().max(200).optional().nullable(),
  priceDifferential: z.number().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// ============================================================================
// APPROVAL OPERATIONS
// ============================================================================

// RETIRED 2026-08-24: approveCADSchema removed with the legacy POST /cad-planning/approve route (landmine No.3)

/**
 * Approve/Reject CAD Purpose
 * POST /api/cad-planning/:styleId/row/:rowId/approve
 * POST /api/cad-planning/:styleId/row/:rowId/reject
 */
export const cadPurposeActionSchema = z.object({
  // approve/reject read only approvalNotes/rejectionNotes — purpose was required but never used.
  purpose: CADPurposeEnum.optional(),
  remarks: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
  rejectionNotes: z.string().max(500).optional(),
  approvalNotes: z.string().max(500).optional(),
});

/**
 * Create Planning Version
 * POST /api/cad-planning/:styleId/planning/:rowId/create-version
 */
export const createPlanningVersionSchema = z.object({
  remarks: z.string().max(500).optional(),
  versionReason: z.string().max(500).optional(),
});

/**
 * Copy CAD Purpose
 * POST /api/cad-planning/:styleId/copy
 */
export const copyCADPurposeSchema = z.object({
  // Optional: the copy handler (copyCADPurpose) derives the source from sourceCadId and never reads
  // sourcePurpose. Requiring it 400'd every copy because the form doesn't send it (BH-0353).
  sourcePurpose: CADPurposeEnum.optional(),
  targetPurpose: CADPurposeEnum,
  cadIds: z.array(z.string().uuid()).optional(),
  remarks: z.string().max(500).optional(),
  sourceCadId: z.string().uuid('Invalid source CAD ID').optional(),
  styleFabricId: z.string().uuid('Invalid style fabric ID').optional(),
  componentId: z.string().uuid('Invalid component ID').optional(),
  patternPartId: z.string().uuid('Invalid pattern part ID').optional(),
});

/**
 * Link CAD to Stock
 * POST /api/cad-planning/:styleId/link-stock
 */
export const linkCADToStockSchema = z.object({
  cadId: z.string().uuid('Invalid CAD ID'),
  fabricStockId: z.string().uuid('Invalid fabric stock ID'),
  remarks: z.string().max(500).optional(),
  procurementId: z.string().uuid('Invalid procurement ID').optional(),
  planningCadWidth: z.number().positive().optional(),
});

/**
 * Approve/Reject CAD Plan
 * PUT /api/cad-planning/:styleId/approve-cad
 * PUT /api/cad-planning/:styleId/reject-cad
 */
export const cadPlanActionSchema = z.object({
  cadSelections: z.record(z.string(), z.string().uuid()).optional(),
  // The Approve action posts fabric->CAD mappings that approveCADPlan requires; without this field
  // validateBody stripped them and the service threw "fabricCADMappings array is required" (BH-0353).
  // Optional because this schema is shared with the Reject action, which sends none.
  fabricCADMappings: z.array(z.object({ fabricId: z.string().uuid(), fabricCADId: z.string().uuid() })).optional(),
  remarks: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
});

// ============================================================================
// PRODUCTION CAD FROM STOCK
// ============================================================================

/**
 * Create Production CAD from Stock
 * POST /api/cad-planning/:styleId/production-from-stock
 */
export const createProductionCADFromStockSchema = z.object({
  fabricStockId: z.string().uuid('Invalid fabric stock ID'),
  styleFabricId: z.string().uuid('Invalid style fabric ID').optional(),
  cadValue: z.number().positive().optional(),
  sizeBreakdown: z.record(z.string(), z.number().nonnegative()).optional(),
  remarks: z.string().max(500).optional(),
  basedOnPlanningCadId: z.string().uuid('Invalid planning CAD ID').optional(),
  componentId: z.string().uuid('Invalid component ID').optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  patternPartId: z.string().uuid('Invalid pattern part ID').optional(),
});

/**
 * Approve Production Variance
 * POST /api/cad-planning/:styleId/row/:rowId/approve-variance
 */
export const approveProductionVarianceSchema = z.object({
  action: VarianceActionEnum,
  notes: z.string().max(500).optional(),
});

/**
 * Sync BOM Fabric from CAD
 * POST /api/cad-planning/:styleId/sync-bom-fabric
 * No body required - triggers sync based on styleId param
 */
export const syncBomFabricSchema = z.object({}).strict();

// ============================================================================
// PATTERN PARTS
// ============================================================================

/**
 * Assign Pattern Parts
 * POST /api/cad-planning/:styleId/fabrics/:fabricId/pattern-parts
 */
export const assignPatternPartsSchema = z.object({
  // BUG-PP2 fix: patternPartIds was never read by controller, removed
  patternParts: z
    .array(
      z.object({
        // BUG-PP1 fix: schema used 'id' but controller expects 'patternPartId'
        patternPartId: z.string().uuid(),
        quantity: z.number().positive().optional(),
        goesToEmbroidery: z.boolean().optional(),
        notes: z.string().max(500).optional().nullable(),
      })
    )
    .min(1, 'At least one pattern part is required'),
});

/**
 * Assign Pattern Parts from Component
 * POST /api/cad-planning/:styleId/fabrics/:fabricId/pattern-parts/from-component
 */
export const assignPatternPartsFromComponentSchema = z.object({
  // Handler works off the route params; componentId was required but never read.
  componentId: z.string().uuid('Invalid component ID').optional(),
});

/**
 * Update Pattern Part Assignment
 * PUT /api/cad-planning/:styleId/pattern-parts/:partId
 */
export const updatePatternPartAssignmentSchema = z.object({
  quantity: z.number().positive().optional(),
  consumptionPerPc: z.number().positive().optional(),
  remarks: z.string().max(500).optional().nullable(),
  goesToEmbroidery: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
});

// ============================================================================
// EMBROIDERY CAD
// ============================================================================

/**
 * Create/Update Embroidery CAD
 * POST /api/cad-planning/:styleId/fabrics/:fabricId/embroidery-cad
 */
export const createOrUpdateEmbroideryCadSchema = z.object({
  // embroideryId accepts CUID (embroidery_master uses @default(cuid()))
  embroideryId: z
    .string()
    .refine(
      (val) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val),
      { message: 'Invalid embroidery ID (expected UUID or CUID)' }
    ),
  fabricWidthCadId: z.string().uuid('Invalid fabric width CAD ID').optional(),
  repeatPattern: z.string().max(50).optional(),
  stitchCount: z.number().int().positive().optional(),
  threadConsumption: z.number().positive().optional(),
  machineTime: z.number().positive().optional(),
  costPerPc: z.number().nonnegative().optional(),
  remarks: z.string().max(500).optional(),
  // CAD measurement fields
  cadMeters: z.number().nonnegative().optional(),
  cadYards: z.number().nonnegative().optional(),
  cadWastagePercent: z.number().min(0).max(100).optional(),
  layerMarginMeters: z.number().nonnegative().optional(),
  piecesPerMarker: z.number().int().positive().optional(),
  markerEfficiency: z.number().min(0).max(100).optional(),
  printDirection: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  sizeBreakdowns: z
    .array(
      z.object({
        sizeName: z.string(),
        quantity: z.number().nonnegative(),
      })
    )
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type GenerateCADOptionsInput = z.infer<typeof generateCADOptionsSchema>;
export type CalculateCADCostInput = z.infer<typeof calculateCADCostSchema>;
export type SelectGreigeForGroupInput = z.infer<typeof selectGreigeForGroupSchema>;
export type AddCADTableRowInput = z.infer<typeof addCADTableRowSchema>;
export type AddCombinedCADRowInput = z.infer<typeof addCombinedCADRowSchema>;
export type UpdateCADTableRowInput = z.infer<typeof updateCADTableRowSchema>;
export type AddCADWidthInput = z.infer<typeof addCADWidthSchema>;
export type UpdateCADValuesWithBreakdownInput = z.infer<typeof updateCADValuesWithBreakdownSchema>;
export type UpdateCADValuesInput = z.infer<typeof updateCADValuesSchema>;
export type CADPurposeActionInput = z.infer<typeof cadPurposeActionSchema>;
export type CreatePlanningVersionInput = z.infer<typeof createPlanningVersionSchema>;
export type CopyCADPurposeInput = z.infer<typeof copyCADPurposeSchema>;
export type LinkCADToStockInput = z.infer<typeof linkCADToStockSchema>;
export type CADPlanActionInput = z.infer<typeof cadPlanActionSchema>;
export type CreateProductionCADFromStockInput = z.infer<typeof createProductionCADFromStockSchema>;
export type ApproveProductionVarianceInput = z.infer<typeof approveProductionVarianceSchema>;
export type AssignPatternPartsInput = z.infer<typeof assignPatternPartsSchema>;
export type AssignPatternPartsFromComponentInput = z.infer<typeof assignPatternPartsFromComponentSchema>;
export type UpdatePatternPartAssignmentInput = z.infer<typeof updatePatternPartAssignmentSchema>;
export type CreateOrUpdateEmbroideryCadInput = z.infer<typeof createOrUpdateEmbroideryCadSchema>;
export type CADApprovalStatusType = z.infer<typeof CADApprovalStatusEnum>;
export type SyncBomFabricInput = z.infer<typeof syncBomFabricSchema>;
// BUG-CAD10 fix: added type exports for new enums
export type VarianceApprovalStatusType = z.infer<typeof VarianceApprovalStatusEnum>;
export type GreigeRateSourceType = z.infer<typeof GreigeRateSourceEnum>;
