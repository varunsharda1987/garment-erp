/**
 * Fabric Costing Validation Schemas
 *
 * Zod schemas for fabric costing calculations and options.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// RATE LOOKUP SCHEMAS
// ============================================================================

/**
 * Lookup Processor Rate
 * POST /api/fabric-costing/lookup-rate
 */
export const lookupRateSchema = z.object({
  greigeId: z.string().uuid('Invalid greige ID'),
  processorId: z.string().uuid('Invalid processor ID'),
  quantity: z.number().positive().optional(),
  processType: z.string().max(50).optional(),
});

// ============================================================================
// SAVE COSTING SCHEMAS
// ============================================================================

/**
 * Save Fabric Costing
 * POST /api/fabric-costing/save
 */
export const saveFabricCostingSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  fabrics: z
    .array(
      z.object({
        fabricId: z.string().uuid('Invalid fabric ID'),
        greigeId: z.string().uuid('Invalid greige ID').optional().nullable(),
        processorId: z.string().uuid('Invalid processor ID').optional().nullable(),
        sourcingType: z.enum(['GREIGE_PROCESSED', 'READY_FABRIC', 'STOCK_REUSE']).optional(),
        ratePerMeter: z.number().nonnegative().optional(),
        quantity: z.number().positive().optional(),
        totalCost: z.number().nonnegative().optional(),
        remarks: z.string().max(500).optional(),
      })
    )
    .min(1, 'At least one fabric is required'),
  runId: z.string().uuid('Invalid run ID').optional(),
  costSheetId: z.string().uuid('Invalid cost sheet ID').optional(),
});

// ============================================================================
// COSTING OPTIONS SCHEMAS
// ============================================================================

/**
 * Get Costing Options Query
 * GET /api/fabric-costing/options
 */
export const costingOptionsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  styleId: z.string().uuid().optional(),
  isApproved: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().max(100).optional(),
});

/**
 * Approve Costing Option
 * POST /api/fabric-costing/option/:optionId/approve
 */
export const approveCostingOptionSchema = z.object({
  remarks: z.string().max(500).optional(),
});

/**
 * Unapprove Costing Option
 * PATCH /api/fabric-costing/option/:optionId/unapprove
 */
export const unapproveCostingOptionSchema = z.object({
  reason: z.string().max(500).optional(),
});

/**
 * Promote Costing Option
 * POST /api/fabric-costing/option/:optionId/promote
 */
export const promoteCostingOptionSchema = z.object({
  targetStage: z.string().max(50).optional(),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// STYLES COSTING STATUS SCHEMAS
// ============================================================================

/**
 * Get Styles Costing Status
 * POST /api/fabric-costing/styles/costing-status
 */
export const stylesCostingStatusSchema = z.object({
  styleIds: z.array(z.string().uuid()).min(1, 'At least one style ID is required'),
});

// ============================================================================
// CAD TO COSTING PUSH SCHEMAS
// ============================================================================

/**
 * Check CAD Costing Status
 * POST /api/fabric-costing/check-cad-status
 */
export const checkCADCostingStatusSchema = z.object({
  cadRowIds: z.array(z.string().uuid()).min(1, 'At least one CAD row ID is required'),
});

/**
 * Push From CAD
 * POST /api/fabric-costing/push-from-cad
 */
export const pushFromCADSchema = z.object({
  cadRowIds: z.array(z.string().uuid()).min(1, 'At least one CAD row ID is required'),
  runId: z.string().uuid('Invalid run ID').optional(),
  processorId: z.string().uuid('Invalid processor ID').optional(),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// CALCULATION SCHEMAS
// ============================================================================

/**
 * Calculate Single Fabric Cost
 * POST /api/fabric-costing/calculate
 */
export const calculateSingleCostSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID'),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  processorId: z.string().uuid('Invalid processor ID').optional(),
  quantity: z.number().positive().optional(),
  orderQuantity: z.number().int().positive().optional(),
  wastagePercent: z.number().min(0).max(100).optional(),
  sourcingType: z.enum(['GREIGE_PROCESSED', 'READY_FABRIC', 'STOCK_REUSE']).optional(),
});

/**
 * Calculate Batch Fabric Cost
 * POST /api/fabric-costing/batch-calculate
 */
export const calculateBatchCostSchema = z.object({
  fabrics: z
    .array(
      z.object({
        fabricId: z.string().uuid('Invalid fabric ID'),
        greigeId: z.string().uuid('Invalid greige ID').optional(),
        processorId: z.string().uuid('Invalid processor ID').optional(),
        quantity: z.number().positive().optional(),
        sourcingType: z.enum(['GREIGE_PROCESSED', 'READY_FABRIC', 'STOCK_REUSE']).optional(),
      })
    )
    .min(1, 'At least one fabric is required'),
  orderQuantity: z.number().int().positive().optional(),
  wastagePercent: z.number().min(0).max(100).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type LookupRateInput = z.infer<typeof lookupRateSchema>;
export type SaveFabricCostingInput = z.infer<typeof saveFabricCostingSchema>;
export type CostingOptionsQueryInput = z.infer<typeof costingOptionsQuerySchema>;
export type ApproveCostingOptionInput = z.infer<typeof approveCostingOptionSchema>;
export type UnapproveCostingOptionInput = z.infer<typeof unapproveCostingOptionSchema>;
export type PromoteCostingOptionInput = z.infer<typeof promoteCostingOptionSchema>;
export type StylesCostingStatusInput = z.infer<typeof stylesCostingStatusSchema>;
export type CheckCADCostingStatusInput = z.infer<typeof checkCADCostingStatusSchema>;
export type PushFromCADInput = z.infer<typeof pushFromCADSchema>;
export type CalculateSingleCostInput = z.infer<typeof calculateSingleCostSchema>;
export type CalculateBatchCostInput = z.infer<typeof calculateBatchCostSchema>;
