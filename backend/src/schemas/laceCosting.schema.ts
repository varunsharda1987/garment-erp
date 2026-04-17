/**
 * Lace Costing Validation Schemas
 *
 * Zod schemas for lace cost calculation with sourcing strategies.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const LaceSourcingTypeEnum = z.enum(['STOCK_REUSE', 'READY_LACE', 'GREIGE_PROCESSED']);

// ============================================================================
// LACE COSTING SCHEMAS
// ============================================================================

/**
 * Calculate Single Lace Cost
 * POST /api/lace-costing/calculate
 */
export const calculateSingleLaceCostSchema = z.object({
  laceId: z.string().uuid('Invalid lace ID'),
  quantityPerGarment: z.number().positive('Quantity per garment must be positive'),
  orderQuantity: z.number().int().positive().optional(),
  wastagePercent: z.number().min(0).max(100).optional(),
  styleId: z.string().uuid('Invalid style ID').optional(),
  costSheetId: z.string().uuid('Invalid cost sheet ID').optional(),
  sourcingType: LaceSourcingTypeEnum.optional(),
  processorId: z.string().uuid('Invalid processor ID').optional(),
});

/**
 * Calculate Batch Lace Costs
 * POST /api/lace-costing/batch-calculate
 */
export const calculateBatchLaceCostSchema = z.object({
  laceItems: z
    .array(
      z.object({
        laceId: z.string().uuid('Invalid lace ID'),
        quantityPerGarment: z.number().positive('Quantity per garment must be positive'),
        wastagePercent: z.number().min(0).max(100).optional(),
        sourcingType: LaceSourcingTypeEnum.optional(),
        processorId: z.string().uuid('Invalid processor ID').optional(),
      })
    )
    .min(1, 'At least one lace item is required'),
  orderQuantity: z.number().int().positive().optional(),
  styleId: z.string().uuid('Invalid style ID').optional(),
  costSheetId: z.string().uuid('Invalid cost sheet ID').optional(),
});

/**
 * Validate Lace Costing for PO
 * POST /api/lace-costing/validate-po
 */
export const validateLaceCostingPOSchema = z.object({
  costingItemId: z.string().uuid('Invalid costing item ID'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CalculateSingleLaceCostInput = z.infer<typeof calculateSingleLaceCostSchema>;
export type CalculateBatchLaceCostInput = z.infer<typeof calculateBatchLaceCostSchema>;
export type ValidateLaceCostingPOInput = z.infer<typeof validateLaceCostingPOSchema>;
