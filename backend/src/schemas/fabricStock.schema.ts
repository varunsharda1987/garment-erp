/**
 * Fabric & Greige Stock Validation Schemas
 *
 * Zod schemas for fabric-stock and greige-stock endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const StockStatusEnum = z.enum(['AVAILABLE', 'RESERVED', 'IN_TRANSIT', 'AT_PROCESSOR', 'CONSUMED', 'DAMAGED']);

export const StockEntryTypeEnum = z.enum([
  'GRN',
  'PRODUCTION',
  'RETURN',
  'TRANSFER_IN',
  'ADJUSTMENT',
  'PROCESSOR_RETURN',
]);

export const AdjustmentReasonEnum = z.enum(['DAMAGED', 'EXPIRED', 'LOST', 'FOUND', 'CORRECTION', 'SHRINKAGE', 'OTHER']);

// ============================================================================
// FABRIC STOCK SCHEMAS
// ============================================================================

/**
 * Create Fabric Stock
 * POST /api/fabric-stock
 */
export const createFabricStockSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('METER'),
  rate: z.number().nonnegative('Rate cannot be negative').optional(),
  lotNumber: z.string().max(50).optional(),
  rollNumber: z.string().max(50).optional(),
  width: z.number().positive().optional(),
  gsm: z.number().positive().optional(),
  shrinkage: z.number().min(0).max(100).optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Fabric Stock
 * PATCH /api/fabric-stock/:id
 */
export const updateFabricStockSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  lotNumber: z.string().max(50).optional().nullable(),
  rollNumber: z.string().max(50).optional().nullable(),
  width: z.number().positive().optional().nullable(),
  gsm: z.number().positive().optional().nullable(),
  shrinkage: z.number().min(0).max(100).optional().nullable(),
  rate: z.number().nonnegative().optional().nullable(),
  status: StockStatusEnum.optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Transfer Fabric Stock
 * POST /api/fabric-stock/transfer
 */
export const transferFabricStockSchema = z
  .object({
    stockId: z.string().uuid('Invalid stock ID'),
    fromWarehouseId: z.string().uuid('Invalid source warehouse ID'),
    toWarehouseId: z.string().uuid('Invalid destination warehouse ID'),
    quantity: z.number().positive('Quantity must be positive'),
    remarks: z.string().max(500).optional(),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: 'Source and destination warehouses must be different',
    path: ['toWarehouseId'],
  });

/**
 * Adjust Fabric Stock
 * POST /api/fabric-stock/adjust
 */
export const adjustFabricStockSchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
  adjustmentQuantity: z.number().refine((val) => val !== 0, {
    message: 'Adjustment quantity cannot be zero',
  }),
  reason: AdjustmentReasonEnum,
  remarks: z.string().max(500).optional(),
});

/**
 * Fabric Stock Query Params
 * GET /api/fabric-stock
 */
export const fabricStockQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  fabricId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: StockStatusEnum.optional(),
  minQuantity: z.string().transform(Number).pipe(z.number().nonnegative()).optional(),
});

// ============================================================================
// GREIGE STOCK SCHEMAS
// ============================================================================

/**
 * Create Greige Stock Entry
 * POST /api/greige/stock-entry
 */
export const createGreigeStockSchema = z.object({
  greigeId: z.string().uuid('Invalid greige ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('METER'),
  rate: z.number().nonnegative('Rate cannot be negative').optional(),
  lotNumber: z.string().max(50).optional(),
  rollNumber: z.string().max(50).optional(),
  width: z.number().positive().optional(),
  gsm: z.number().positive().optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
  // Greige-specific fields
  greigeWidth: z.number().positive().optional(),
  qualityGrade: z.string().max(20).optional(),
});

/**
 * Update Greige Stock Entry
 * PATCH /api/greige/stock/:stockId
 */
export const updateGreigeStockSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  lotNumber: z.string().max(50).optional().nullable(),
  rollNumber: z.string().max(50).optional().nullable(),
  width: z.number().positive().optional().nullable(),
  gsm: z.number().positive().optional().nullable(),
  rate: z.number().nonnegative().optional().nullable(),
  status: StockStatusEnum.optional(),
  qualityGrade: z.string().max(20).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Adjust Greige Stock
 * POST /api/greige/stock/:stockId/adjust
 */
export const adjustGreigeStockSchema = z.object({
  adjustmentQuantity: z.number().refine((val) => val !== 0, {
    message: 'Adjustment quantity cannot be zero',
  }),
  reason: AdjustmentReasonEnum,
  remarks: z.string().max(500).optional(),
});

/**
 * Greige Stock Query Params
 * GET /api/greige/stock
 */
export const greigeStockQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  greigeId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: StockStatusEnum.optional(),
  processorId: z.string().uuid().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateFabricStockInput = z.infer<typeof createFabricStockSchema>;
export type UpdateFabricStockInput = z.infer<typeof updateFabricStockSchema>;
export type TransferFabricStockInput = z.infer<typeof transferFabricStockSchema>;
export type AdjustFabricStockInput = z.infer<typeof adjustFabricStockSchema>;
export type FabricStockQueryInput = z.infer<typeof fabricStockQuerySchema>;

export type CreateGreigeStockInput = z.infer<typeof createGreigeStockSchema>;
export type UpdateGreigeStockInput = z.infer<typeof updateGreigeStockSchema>;
export type AdjustGreigeStockInput = z.infer<typeof adjustGreigeStockSchema>;
export type GreigeStockQueryInput = z.infer<typeof greigeStockQuerySchema>;
