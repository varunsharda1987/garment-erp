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
 * Cost Sheet Item
 */
const costSheetItemSchema = z.object({
  itemType: z.enum(['FABRIC', 'TRIM', 'LABOR', 'OVERHEAD', 'OTHER']),
  itemId: z.string().uuid().optional(),
  description: z.string().max(500),
  quantity: z.number().positive(),
  unit: z.string().max(20).optional(),
  rate: z.number().nonnegative(),
  amount: z.number().nonnegative().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Create Cost Sheet
 * POST /api/style-costing
 */
export const createCostSheetSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  purpose: CostSheetPurposeEnum.optional().default('COSTING'),
  widthCombination: z.string().max(100).optional(),
  fabricCost: z.number().nonnegative().optional().default(0),
  trimCost: z.number().nonnegative().optional().default(0),
  laborCost: z.number().nonnegative().optional().default(0),
  overheadCost: z.number().nonnegative().optional().default(0),
  profitMargin: z.number().min(0).max(100).optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(costSheetItemSchema).optional(),
});

/**
 * Update Cost Sheet
 * PUT /api/style-costing/:id
 */
export const updateCostSheetSchema = z.object({
  widthCombination: z.string().max(100).optional().nullable(),
  fabricCost: z.number().nonnegative().optional(),
  trimCost: z.number().nonnegative().optional(),
  laborCost: z.number().nonnegative().optional(),
  overheadCost: z.number().nonnegative().optional(),
  profitMargin: z.number().min(0).max(100).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
  items: z.array(costSheetItemSchema).optional(),
});

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
export const approveCostSheetSchema = z.object({
  approved: z.boolean(),
  remarks: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
});

/**
 * Create Cost Sheet Version
 * POST /api/style-costing/:id/create-version
 */
export const createCostSheetVersionSchema = z.object({
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
 * Add Lace Item
 * POST /api/style-costing/:costingId/lace-items
 */
export const addLaceItemSchema = z.object({
  laceId: z.string().uuid('Invalid lace ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('METER'),
  rate: z.number().nonnegative('Rate cannot be negative'),
  costOption: z.enum(['STOCK', 'READY', 'GREIGE_PROCESSING']).optional(),
  processingCost: z.number().nonnegative().optional(),
  remarks: z.string().max(500).optional(),
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

export type CreateCostSheetInput = z.infer<typeof createCostSheetSchema>;
export type UpdateCostSheetInput = z.infer<typeof updateCostSheetSchema>;
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
