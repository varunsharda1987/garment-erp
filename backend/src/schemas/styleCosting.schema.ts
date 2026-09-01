/**
 * Style Costing Validation Schemas
 *
 * Zod schemas for cost sheet CRUD, versioning, and lace items.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const CostSheetStatusEnum = z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']);

export const CostSheetPurposeEnum = z.enum(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PROCUREMENT_PRODUCTION']);

export const VarianceStatusEnum = z.enum(['NONE', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']);

// ============================================================================
// COST SHEET SCHEMAS
// ============================================================================

/**
 * Create Cost Sheet — DELETED (T3-A single-schema fix, same class as bug-hunt costing-2).
 * POST /api/style-costing validates with CreateCostSheetSchema from
 * controllers/style-costing.utils.ts — the SAME schema the controller types against. The legacy
 * schema that lived here shared only styleId+purpose with it, so validateBody stripped
 * fabricDetails/trimsDetails/cmtCosts and every UI create failed with 400. Do NOT re-add a
 * second create schema here.
 */

/**
 * Update Cost Sheet — DELETED (bug-hunt costing-2).
 * PUT /api/style-costing/:id validates with UpdateCostSheetSchema from
 * controllers/style-costing.utils.ts — the SAME schema the controller types against. The divergent
 * schema that lived here shared zero fields with it, so validateBody stripped every real field and the
 * endpoint silently discarded all edits while returning success. Do NOT re-add a second schema here.
 */

// generateCostSheetSchema removed 2026-09-01 with POST /style-costing/generate/:styleId — see
// style-costing-calc.controller.ts for why that endpoint was retired.

/**
 * Approve Cost Sheet
 * PATCH /api/style-costing/:id/approve
 */
export const approveCostSheetSchema = z
  .object({
    // Primary contract (bug-hunt costing-22): matches style-costing-approval.controller.ts —
    // validateBody strips unknown keys, so action/rejectionNotes MUST be declared here
    action: z.enum(['approve', 'reject', 'revoke']).optional(),
    rejectionNotes: z.string().max(500).optional(),
    // Legacy boolean contract (frontend costSheet.service.ts still sends `approved`)
    approved: z.boolean().optional(),
    remarks: z.string().max(500).optional(),
    rejectionReason: z.string().max(500).optional(),
  })
  .refine((data) => data.action !== undefined || typeof data.approved === 'boolean', {
    message: 'Either action or approved is required',
  });

/**
 * Create Cost Sheet Version
 * POST /api/style-costing/:id/create-version
 */
export const createCostSheetVersionSchema = z.object({
  // versionReason MUST be declared: the controller requires it and the frontend sends it — without it
  // validateBody stripped the field and every create-version call was rejected (bug-hunt costing-5).
  versionReason: z.string().min(1, 'Version reason is required').max(500),
  remarks: z.string().max(500).optional(),
});

/**
 * Copy Cost Sheet for Procurement
 * POST /api/style-costing/copy
 */
export const copyCostSheetSchema = z.object({
  sourceCostSheetId: z.string().uuid('Invalid source cost sheet ID'),
  purpose: CostSheetPurposeEnum.optional().default('PROCUREMENT_PRODUCTION'),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Actuals
 * PATCH /api/style-costing/:id/actuals
 */
// Matches updateActuals() and the style_costing *_actual columns. The previous names
// (actualFabricCost/actualTrimCost/actualLaborCost/actualOverheadCost) described a 4-bucket cost
// model that does not exist in this DB and shared NO field with the controller, so every actual-cost
// value was silently discarded while the API still returned 200 'Actuals updated'.
export const updateActualsSchema = z.object({
  fabricActual: z.coerce.number().nonnegative().optional(),
  trimsActual: z.coerce.number().nonnegative().optional(),
  cmtActual: z.coerce.number().nonnegative().optional(),
  embroideryActual: z.coerce.number().nonnegative().optional(),
  accessoriesActual: z.coerce.number().nonnegative().optional(),
  totalActual: z.coerce.number().nonnegative().optional(),
});

/**
 * Approve Variance
 * POST /api/style-costing/variance/:id/approve
 */
// The controller reads { action: 'APPROVE' | 'REJECT', notes }. The previous `approved` boolean was
// stripped on the way in and the controller then threw 'Action must be either APPROVE or REJECT',
// so the endpoint could never succeed either way.
export const approveVarianceSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().max(500).optional(),
});

/**
 * Cost Sheet Query Params
 * GET /api/style-costing
 */
export const costSheetQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  styleId: z.string().uuid().optional(),
  purpose: CostSheetPurposeEnum.optional(),
  status: CostSheetStatusEnum.optional(),
  varianceStatus: VarianceStatusEnum.optional(),
});

// ============================================================================
// LACE ITEM SCHEMAS
// ============================================================================

/**
 * Lace Sourcing Strategy
 */
export const LaceSourcingStrategyEnum = z.enum(['STOCK_REUSE', 'READY_LACE', 'GREIGE_PROCESSED']);

/**
 * Add Lace Item
 * POST /api/style-costing/:costingId/lace-items
 */
export const addLaceItemSchema = z.object({
  laceId: z.string().uuid('Invalid lace ID'),
  laceName: z.string().max(200),
  colorName: z.string().max(100).optional(),
  width: z.number().positive().optional(),
  quantityPerGarment: z.number().nonnegative(),
  wastagePercent: z.number().min(0).max(100).optional(),
  sourcingStrategy: LaceSourcingStrategyEnum,
  greigeCost: z.number().nonnegative().optional(),
  readyLaceCost: z.number().nonnegative().optional(),
  stockCost: z.number().nonnegative().optional(),
  costPerMeter: z.number().nonnegative(),
  greigeLaceId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  rateCardId: z.string().uuid().optional(),
  stockLotId: z.string().uuid().optional(),
  procurementId: z.string().uuid().optional(),
  labDipId: z.string().uuid().optional(),
  labDipStatus: z.string().max(50).optional(),
  isManualOverride: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
  processingCost: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Update Lace Item
 * PUT /api/style-costing/:costingId/lace-items/:itemId
 */
// Matches updateLaceItemController + the style_costing_lace_items columns. The previous
// {quantity, unit, rate, costOption} shape referenced fields that are not columns at all, so every
// real edit (width, wastage, the four cost components) was stripped and silently lost.
export const updateLaceItemSchema = z.object({
  sourcingStrategy: z.enum(['STOCK_REUSE', 'READY_LACE', 'GREIGE_PROCESSED']).optional(),
  width: z.coerce.number().nonnegative().optional(),
  quantityPerGarment: z.coerce.number().nonnegative().optional(),
  wastagePercent: z.coerce.number().min(0).max(100).optional(),
  greigeCost: z.coerce.number().nonnegative().optional().nullable(),
  processingCost: z.coerce.number().nonnegative().optional().nullable(),
  readyLaceCost: z.coerce.number().nonnegative().optional().nullable(),
  stockCost: z.coerce.number().nonnegative().optional().nullable(),
  costPerMeter: z.coerce.number().nonnegative().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Bulk Add Lace Items
 * POST /api/style-costing/:costingId/lace-items/bulk
 */
export const bulkAddLaceItemsSchema = z.object({
  items: z
    .array(
      z.object({
        laceId: z.string().uuid('Invalid lace ID'),
        quantity: z.number().positive('Quantity must be positive'),
        unit: z.string().max(20).optional().default('METER'),
        rate: z.number().nonnegative('Rate cannot be negative'),
        costOption: z.enum(['STOCK', 'READY', 'GREIGE_PROCESSING']).optional(),
        processingCost: z.number().nonnegative().optional(),
        remarks: z.string().max(500).optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

/**
 * Calculate Lace Options
 * POST /api/style-costing/:costingId/lace-items/calculate-options
 */
// Matches calculateLaceOptions(). The old {laceId, quantity} shape stripped everything the
// controller requires, so it always threw 'Missing required fields: laceId, quantityPerGarment'.
export const calculateLaceOptionsSchema = z.object({
  laceId: z.string().uuid('Invalid lace ID'),
  quantityPerGarment: z.coerce.number().nonnegative('Quantity per garment must be 0 or greater'),
  wastagePercent: z.coerce.number().min(0).max(100), // required: 0 is valid (no wastage)
  orderQuantity: z.coerce.number().nonnegative().optional(),
  styleId: z.string().uuid('Invalid style ID').optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

// CreateCostSheetInput / UpdateCostSheetInput: infer from CreateCostSheetSchema / UpdateCostSheetSchema
// in controllers/style-costing.utils.ts (the ONE create/update schema pair — see notes above)
export type ApproveCostSheetInput = z.infer<typeof approveCostSheetSchema>;
export type CreateCostSheetVersionInput = z.infer<typeof createCostSheetVersionSchema>;
export type CopyCostSheetInput = z.infer<typeof copyCostSheetSchema>;
export type UpdateActualsInput = z.infer<typeof updateActualsSchema>;
export type ApproveVarianceInput = z.infer<typeof approveVarianceSchema>;
export type CostSheetQueryInput = z.infer<typeof costSheetQuerySchema>;

export type AddLaceItemInput = z.infer<typeof addLaceItemSchema>;
export type UpdateLaceItemInput = z.infer<typeof updateLaceItemSchema>;
export type BulkAddLaceItemsInput = z.infer<typeof bulkAddLaceItemsSchema>;
export type CalculateLaceOptionsInput = z.infer<typeof calculateLaceOptionsSchema>;
