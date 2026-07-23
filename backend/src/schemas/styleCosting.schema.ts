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

/**
 * Generate Cost Sheet from Style
 * POST /api/style-costing/generate/:styleId
 */
export const generateCostSheetSchema = z.object({
  purpose: CostSheetPurposeEnum.optional().default('COSTING'),
  widthCombination: z.string().max(100).optional(),
});

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
export const updateActualsSchema = z.object({
  actualFabricCost: z.number().nonnegative().optional(),
  actualTrimCost: z.number().nonnegative().optional(),
  actualLaborCost: z.number().nonnegative().optional(),
  actualOverheadCost: z.number().nonnegative().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Approve Variance
 * POST /api/style-costing/variance/:id/approve
 */
export const approveVarianceSchema = z.object({
  approved: z.boolean(),
  remarks: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
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
export const updateLaceItemSchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  rate: z.number().nonnegative().optional(),
  costOption: z.enum(['STOCK', 'READY', 'GREIGE_PROCESSING']).optional(),
  processingCost: z.number().nonnegative().optional().nullable(),
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
export const calculateLaceOptionsSchema = z.object({
  laceId: z.string().uuid('Invalid lace ID'),
  quantity: z.number().positive('Quantity must be positive'),
});

// ============================================================================
// Type Exports
// ============================================================================

// CreateCostSheetInput / UpdateCostSheetInput: infer from CreateCostSheetSchema / UpdateCostSheetSchema
// in controllers/style-costing.utils.ts (the ONE create/update schema pair — see notes above)
export type GenerateCostSheetInput = z.infer<typeof generateCostSheetSchema>;
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
