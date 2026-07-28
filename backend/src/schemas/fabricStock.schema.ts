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

// Status enum for fabric stock entries (matches controller usage)
export const FabricStockStatusEnum = z.enum(['AVAILABLE', 'RESERVED', 'EXHAUSTED', 'ISSUED', 'PENDING_RETURN']);

// Stock type enum for fabric stock entries (matches controller usage)
export const FabricStockTypeEnum = z.enum([
  'GENERIC',
  'PLANNED_STOCK',
  'EXCESS',
  'EXCESS_MOQ',
  'CROSS_STYLE_REUSE',
  'RETURNED',
  'VARIANCE_UNUSED',
]);

// Quality grade enum
export const QualityGradeEnum = z.enum(['A', 'B', 'DEFECT']);

// Legacy enums (kept for greige stock and other modules)
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
 * POST /api/fabric-stock (or /api/stock)
 * Aligned with controller and database model
 */
export const createFabricStockSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID'),
  width: z.number().positive('Width must be positive'),
  quantityAvailable: z.number().positive('Quantity must be positive'),
  rollNumbers: z.string().optional(),
  warehouseLocation: z.string().optional(),
  rackNumber: z.string().optional(),
  purchaseCost: z.number().nonnegative().optional(),
  qualityGrade: QualityGradeEnum.default('A'),
  stockType: FabricStockTypeEnum.default('GENERIC'),
  receivedDate: z.string().or(z.date()).optional(),
  status: FabricStockStatusEnum.default('AVAILABLE'),
  procurementId: z.string().uuid('Invalid procurement ID').optional(),
  originStyleId: z.string().uuid('Invalid style ID').optional(),
  originOrderId: z.string().uuid('Invalid order ID').optional(),
  // Optional operator note; persisted onto the initial STOCK_IN transaction (B01-07)
  notes: z.string().max(500).optional(),
});

/**
 * Update Fabric Stock
 * PATCH /api/fabric-stock/:id (or /api/stock/:id)
 * Single source of truth (controller consumes typed req.body)
 */
export const updateFabricStockSchema = z
  .object({
    purchaseCost: z.number().nonnegative().optional(),
    weightedAvgCost: z.number().nonnegative().optional(),
    qualityGrade: QualityGradeEnum.optional(),
    warehouseLocation: z.string().optional(),
    rackNumber: z.string().optional(),
    rollNumbers: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Transfer Fabric Stock
 * POST /api/fabric-stock/transfer (or /api/stock/transfer)
 * Single source of truth (controller consumes typed req.body)
 */
export const transferFabricStockSchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
  toWarehouse: z.string().min(1, 'Destination warehouse is required'),
  toRackNumber: z.string().optional(),
  quantityToTransfer: z.number().positive('Quantity must be positive'),
  notes: z.string().max(500).optional(),
});

/**
 * Adjust Fabric Stock
 * POST /api/fabric-stock/adjust (or /api/stock/adjust)
 * Single source of truth (controller consumes typed req.body)
 */
export const adjustFabricStockSchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
  adjustmentType: z.enum(['INCREASE', 'DECREASE']),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().max(500).optional(),
});

/**
 * Fabric Stock Query Params
 * GET /api/fabric-stock
 */
export const fabricStockQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(500)).optional(), // 500 so the Stock-Out fabric picker (requests 200) isn't rejected/truncated
  search: z.string().max(100).optional(),
  fabricId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: FabricStockStatusEnum.optional(),
  embroideryId: z.string().uuid().optional(),
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
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  warehouseLocation: z.string().max(255).optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('METER'),
  rate: z.number().nonnegative('Rate cannot be negative').optional(),
  purchaseCost: z.number().nonnegative('Purchase cost cannot be negative').optional(),
  lotNumber: z.string().max(50).optional(),
  rollNumber: z.string().max(50).optional(),
  rollNumbers: z.string().max(500).optional(),
  width: z.number().positive().optional(),
  gsm: z.number().positive().optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
  receivedDate: z.string().datetime().or(z.date()).optional(),
  // Greige-specific fields
  greigeWidth: z.number().positive().optional(),
  qualityGrade: z.string().max(20).optional(),
  // Invoice tracking
  invoiceNumber: z.string().max(50).optional(),
  invoiceDate: z.string().datetime().or(z.date()).optional(),
  // Fold/Than tracking - for calculating actual meters from nominal
  foldLengthCm: z.number().positive().max(100).optional(), // "L" - fold length in cm
  thanCount: z.number().int().positive().optional(), // Number of thans in this lot
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
  adjustmentType: z.enum(['INCREASE', 'DECREASE']),
  quantity: z.number().positive('Quantity must be positive'),
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
  invoiceNumber: z.string().max(50).optional(),
});

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const fabricStockIdParamSchema = z.object({
  id: z.string().uuid('Invalid fabric stock ID'),
});

export const stockIdParamSchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
});

export const greigeStockIdParamSchema = z.object({
  greigeId: z.string().uuid('Invalid greige ID'),
});

export const processorIdParamSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
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
