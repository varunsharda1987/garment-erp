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

export const VarianceActionEnum = z.enum(['APPROVE', 'REJECT']);

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
});

/**
 * Calculate CAD Cost
 * POST /api/cad-planning/calculate-cost
 */
export const calculateCADCostSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  cadId: z.string().uuid('Invalid CAD ID').optional(),
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  greigeWidth: z.number().positive().optional(),
  cadValue: z.number().positive().optional(),
  quantity: z.number().positive().optional(),
});

/**
 * Select Greige for Group
 * POST /api/cad-planning/:styleId/select-greige
 */
export const selectGreigeForGroupSchema = z.object({
  fabricGroupKey: z.string().max(100),
  greigeId: z.string().uuid('Invalid greige ID'),
  genericGreigeName: z.string().max(200).optional(),
});

// ============================================================================
// CAD ROW OPERATIONS
// ============================================================================

/**
 * Add CAD Table Row
 * POST /api/cad-planning/:styleId/row
 */
export const addCADTableRowSchema = z.object({
  styleFabricId: z.string().uuid('Invalid style fabric ID').optional(),
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  greigeWidth: z.number().positive(),
  cadValue: z.number().positive().optional(),
  purpose: CADPurposeEnum.optional().default('COSTING'),
  isPreferred: z.boolean().optional().default(false),
  remarks: z.string().max(500).optional(),
  sizeBreakdown: z.record(z.string(), z.number().nonnegative()).optional(),
});

/**
 * Add Combined CAD Row
 * POST /api/cad-planning/:styleId/combined-row
 */
export const addCombinedCADRowSchema = z.object({
  styleFabricIds: z.array(z.string().uuid()).min(1, 'At least one style fabric is required'),
  greigeId: z.string().uuid('Invalid greige ID'),
  greigeWidth: z.number().positive(),
  cadValue: z.number().positive().optional(),
  purpose: CADPurposeEnum.optional().default('COSTING'),
  remarks: z.string().max(500).optional(),
});

/**
 * Update CAD Table Row
 * PUT /api/cad-planning/:styleId/row/:rowId
 */
export const updateCADTableRowSchema = z.object({
  greigeWidth: z.number().positive().optional(),
  cadValue: z.number().positive().optional(),
  isPreferred: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
  sizeBreakdown: z.record(z.string(), z.number().nonnegative()).optional().nullable(),
});

/**
 * Add CAD Width (Legacy)
 * POST /api/cad-planning/:styleId/add-width
 */
export const addCADWidthSchema = z.object({
  fabricGroupKey: z.string().max(100),
  greigeId: z.string().uuid('Invalid greige ID'),
  greigeWidth: z.number().positive(),
});

/**
 * Update CAD Values with Breakdown
 * PUT /api/cad-planning/cad/:cadId
 */
export const updateCADValuesWithBreakdownSchema = z.object({
  cadValue: z.number().positive().optional(),
  sizeBreakdown: z.record(z.string(), z.number().nonnegative()).optional(),
  remarks: z.string().max(500).optional().nullable(),
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
});

// ============================================================================
// APPROVAL OPERATIONS
// ============================================================================

/**
 * Approve CAD (Legacy)
 * POST /api/cad-planning/approve
 */
export const approveCADSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  cadId: z.string().uuid('Invalid CAD ID'),
  remarks: z.string().max(500).optional(),
});

/**
 * Approve/Reject CAD Purpose
 * POST /api/cad-planning/:styleId/row/:rowId/approve
 * POST /api/cad-planning/:styleId/row/:rowId/reject
 */
export const cadPurposeActionSchema = z.object({
  purpose: CADPurposeEnum,
  remarks: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
});

/**
 * Create Planning Version
 * POST /api/cad-planning/:styleId/planning/:rowId/create-version
 */
export const createPlanningVersionSchema = z.object({
  remarks: z.string().max(500).optional(),
});

/**
 * Copy CAD Purpose
 * POST /api/cad-planning/:styleId/copy
 */
export const copyCADPurposeSchema = z.object({
  sourcePurpose: CADPurposeEnum,
  targetPurpose: CADPurposeEnum,
  cadIds: z.array(z.string().uuid()).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Link CAD to Stock
 * POST /api/cad-planning/:styleId/link-stock
 */
export const linkCADToStockSchema = z.object({
  cadId: z.string().uuid('Invalid CAD ID'),
  fabricStockId: z.string().uuid('Invalid fabric stock ID'),
  remarks: z.string().max(500).optional(),
});

/**
 * Approve/Reject CAD Plan
 * PUT /api/cad-planning/:styleId/approve-cad
 * PUT /api/cad-planning/:styleId/reject-cad
 */
export const cadPlanActionSchema = z.object({
  cadSelections: z.record(z.string(), z.string().uuid()).optional(),
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
});

/**
 * Approve Production Variance
 * POST /api/cad-planning/:styleId/row/:rowId/approve-variance
 */
export const approveProductionVarianceSchema = z.object({
  action: VarianceActionEnum,
  notes: z.string().max(500).optional(),
});

// ============================================================================
// PATTERN PARTS
// ============================================================================

/**
 * Assign Pattern Parts
 * POST /api/cad-planning/:styleId/fabrics/:fabricId/pattern-parts
 */
export const assignPatternPartsSchema = z.object({
  patternPartIds: z.array(z.string().uuid()).min(1, 'At least one pattern part is required'),
});

/**
 * Assign Pattern Parts from Component
 * POST /api/cad-planning/:styleId/fabrics/:fabricId/pattern-parts/from-component
 */
export const assignPatternPartsFromComponentSchema = z.object({
  componentId: z.string().uuid('Invalid component ID'),
});

/**
 * Update Pattern Part Assignment
 * PUT /api/cad-planning/:styleId/pattern-parts/:partId
 */
export const updatePatternPartAssignmentSchema = z.object({
  quantity: z.number().positive().optional(),
  consumptionPerPc: z.number().positive().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

// ============================================================================
// EMBROIDERY CAD
// ============================================================================

/**
 * Create/Update Embroidery CAD
 * POST /api/cad-planning/:styleId/fabrics/:fabricId/embroidery-cad
 */
export const createOrUpdateEmbroideryCadSchema = z.object({
  embroideryId: z.string().uuid('Invalid embroidery ID'),
  repeatPattern: z.string().max(50).optional(),
  stitchCount: z.number().int().positive().optional(),
  threadConsumption: z.number().positive().optional(),
  machineTime: z.number().positive().optional(),
  costPerPc: z.number().nonnegative().optional(),
  remarks: z.string().max(500).optional(),
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
export type ApproveCADInput = z.infer<typeof approveCADSchema>;
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
