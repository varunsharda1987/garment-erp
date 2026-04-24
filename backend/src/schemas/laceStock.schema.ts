/**
 * Lace Stock Validation Schemas
 *
 * Zod schemas for lace stock CRUD and operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const LaceStockStatusEnum = z.enum(['AVAILABLE', 'ALLOCATED', 'CONSUMED', 'RETURNED']);

export const LaceStockTypeEnum = z.enum(['PURCHASED', 'PRODUCED', 'TRANSFERRED']);

export const AllocationTypeEnum = z.enum(['PRODUCTION', 'SAMPLE', 'RESERVE']);

// ============================================================================
// LACE STOCK SCHEMAS
// ============================================================================

/**
 * Create Lace Stock
 * POST /api/lace-stock
 */
export const createLaceStockSchema = z
  .object({
    laceId: z.string().uuid('Invalid lace ID'),
    quantityAvailable: z.number().positive('Quantity must be positive'),
    weightedAvgCost: z.number().nonnegative('Cost cannot be negative'),
    purchaseCost: z.number().nonnegative().optional(),
    lotNumber: z.string().max(50).optional(),
    dyeLotNumber: z.string().max(50).optional(),
    shadeNote: z.string().max(200).optional(),
    originStyleId: z.string().uuid().optional(),
    originStyleCode: z.string().max(50).optional(),
    originOrderId: z.string().uuid().optional(),
    procurementId: z.string().uuid().optional(),
    processingBatchId: z.string().uuid().optional(),
    warehouseLocation: z.string().max(100).optional(),
    rackNumber: z.string().max(50).optional(),
    qualityGrade: z.string().max(20).optional(),
    stockType: LaceStockTypeEnum.optional().default('PURCHASED'),
    grnId: z.string().uuid().optional(),
    expiryDate: z.string().datetime().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Allocate Stock
 * POST /api/lace-stock/:id/allocate
 */
export const allocateLaceStockSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  styleId: z.string().uuid('Invalid style ID'),
  styleCode: z.string().max(50).optional(),
  quantityToAllocate: z.number().positive('Quantity must be positive'),
  allocationType: AllocationTypeEnum.optional().default('PRODUCTION'),
  notes: z.string().max(500).optional(),
});

/**
 * Transfer Stock
 * POST /api/lace-stock/:id/transfer
 */
export const transferLaceStockSchema = z.object({
  toOrderId: z.string().uuid('Invalid target order ID'),
  toStyleId: z.string().uuid('Invalid target style ID'),
  toStyleCode: z.string().max(50).optional(),
  quantityToTransfer: z.number().positive('Quantity must be positive'),
  transferNotes: z.string().max(500).optional(),
});

/**
 * Consume Allocated Stock
 * POST /api/lace-stock/allocations/:allocationId/consume
 */
export const consumeLaceStockSchema = z.object({
  quantityConsumed: z.number().positive('Quantity must be positive'),
  notes: z.string().max(500).optional(),
});

/**
 * Return Stock
 * POST /api/lace-stock/allocations/:allocationId/return
 */
export const returnLaceStockSchema = z.object({
  quantityToReturn: z.number().positive('Quantity must be positive'),
  notes: z.string().max(500).optional(),
});

/**
 * Lace Stock Query Params
 * GET /api/lace-stock
 */
export const laceStockQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  laceId: z.string().uuid().optional(),
  originStyleId: z.string().uuid().optional(),
  originOrderId: z.string().uuid().optional(),
  status: LaceStockStatusEnum.optional(),
  stockType: LaceStockTypeEnum.optional(),
  qualityGrade: z.string().max(20).optional(),
  warehouseLocation: z.string().max(100).optional(),
  minQuantity: z.string().transform(Number).pipe(z.number().nonnegative()).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateLaceStockInput = z.infer<typeof createLaceStockSchema>;
export type AllocateLaceStockInput = z.infer<typeof allocateLaceStockSchema>;
export type TransferLaceStockInput = z.infer<typeof transferLaceStockSchema>;
export type ConsumeLaceStockInput = z.infer<typeof consumeLaceStockSchema>;
export type ReturnLaceStockInput = z.infer<typeof returnLaceStockSchema>;
export type LaceStockQueryInput = z.infer<typeof laceStockQuerySchema>;
