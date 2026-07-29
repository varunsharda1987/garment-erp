/**
 * Stock Movement Validation Schemas
 *
 * Zod schemas for stock movement endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * Pattern:
 * 1. Define schema here
 * 2. Export inferred type: `export type X = z.infer<typeof xSchema>`
 * 3. Use in routes: `validateBody(xSchema)`
 * 4. Controller receives fully-typed body
 */

import { z } from 'zod';

// ============================================================================
// Enums (match Prisma enums)
// ============================================================================

export const UnitEnum = z.enum([
  'METER',
  'PIECE',
  'KILOGRAM',
  'SET',
  'YARD',
  'DOZEN',
  'GROSS',
  'TUBE',
  'CONE',
  'SPOOL',
  'BOX',
  'PAIR',
  'PACK',
  'GRAM',
  'LITER',
  'ROLL',
]);

export const ItemTypeEnum = z.enum([
  'GREIGE',
  'FABRIC',
  'MATERIAL',
  'LACE',
  'BUTTON',
  'THREAD',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'PACKAGING',
]);

export const AdjustmentReasonEnum = z.enum(['DAMAGED', 'EXPIRED', 'LOST', 'FOUND', 'CORRECTION', 'OTHER']);

// ============================================================================
// Stock IN Schemas
// ============================================================================

/**
 * Create Stock IN (single item)
 * POST /api/stock-movements/stock-in
 */
export const createStockInSchema = z.object({
  // Material identification (either materialId OR itemType+itemId)
  materialId: z.string().uuid('Invalid material ID').optional(),
  itemType: ItemTypeEnum.optional(),
  itemId: z.string().uuid('Invalid item ID').optional(),

  // Required fields
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: UnitEnum,

  // Supplier (direct reference - NEW!)
  supplierId: z.string().uuid('Invalid supplier ID').optional(),

  // Optional fields
  rate: z.number().nonnegative('Rate cannot be negative').optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),

  // Fabric/Greige specific
  foldLengthCm: z.number().positive().optional(),
  thanCount: z.number().int().positive().optional(),

  // Invoice tracking
  invoiceNumber: z.string().max(50).optional(),
  invoiceDate: z.string().datetime().or(z.date()).optional(),
});

/**
 * Bulk Stock IN item
 */
export const bulkStockInItemSchema = z.object({
  materialId: z.string().uuid('Invalid material ID').optional(),
  itemType: ItemTypeEnum.optional(),
  itemId: z.string().uuid('Invalid item ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: UnitEnum,
  rate: z.number().nonnegative().optional(),
  foldLengthCm: z.number().positive().optional(),
  thanCount: z.number().int().positive().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Create Bulk Stock IN (multiple items)
 * POST /api/stock-movements/bulk-stock-in
 */
export const createBulkStockInSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  referenceType: z.string().max(50).optional(),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(bulkStockInItemSchema).min(1, 'At least one item required').max(50, 'Maximum 50 items allowed'),

  // Invoice tracking
  invoiceNumber: z.string().max(50).optional(),
  invoiceDate: z.string().datetime().or(z.date()).optional(),
});

// ============================================================================
// Stock OUT Schema
// ============================================================================

/**
 * Create Stock OUT (issue)
 * POST /api/stock-movements/stock-out
 */
export const createStockOutSchema = z.object({
  materialId: z.string().uuid('Invalid material ID').optional(),
  itemType: ItemTypeEnum.optional(),
  itemId: z.string().uuid('Invalid item ID').optional(),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: UnitEnum,
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Stock Transfer Schema
// ============================================================================

/**
 * Create Stock Transfer
 * POST /api/stock-movements/transfer
 */
export const createStockTransferSchema = z
  .object({
    materialId: z.string().uuid('Invalid material ID'),
    fromWarehouseId: z.string().uuid('Invalid source warehouse ID'),
    toWarehouseId: z.string().uuid('Invalid destination warehouse ID'),
    quantity: z.number().positive('Quantity must be positive'),
    unit: UnitEnum,
    remarks: z.string().max(500).optional(),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: 'Source and destination warehouses must be different',
    path: ['toWarehouseId'],
  });

// ============================================================================
// Stock Adjustment Schema
// ============================================================================

/**
 * Create Stock Adjustment
 * POST /api/stock-movements/adjustment
 */
export const createStockAdjustmentSchema = z.object({
  materialId: z.string().uuid('Invalid material ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  adjustmentQuantity: z.number().refine((val) => val !== 0, {
    message: 'Adjustment quantity cannot be zero',
  }),
  unit: UnitEnum,
  reason: AdjustmentReasonEnum,
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Processor Return Schema
// ============================================================================

/**
 * Create Stock IN from Processor Return
 * POST /api/stock-movements/processor-return
 */
export const createProcessorReturnSchema = z.object({
  greigeStockId: z.string().uuid('Invalid greige stock ID'),
  receivedQuantity: z.number().positive('Quantity must be positive'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * Stock Movement Query Params
 * GET /api/stock-movements
 */
export const stockMovementQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
  movementType: z
    .enum(['STOCK_IN', 'STOCK_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'])
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
});

/**
 * Movement Summary Query Params
 * GET /api/stock-movements/summary/:warehouseId
 */
export const movementSummaryQuerySchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
});

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const stockMovementIdParamSchema = z.object({
  id: z.string().uuid('Invalid movement ID'),
});

export const materialIdParamSchema = z.object({
  materialId: z.string().uuid('Invalid material ID'),
});

export const warehouseIdParamSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
});

export const materialWarehouseParamSchema = z.object({
  materialId: z.string().uuid('Invalid material ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type CreateStockInInput = z.infer<typeof createStockInSchema>;
export type BulkStockInItemInput = z.infer<typeof bulkStockInItemSchema>;
export type CreateBulkStockInInput = z.infer<typeof createBulkStockInSchema>;
export type CreateStockOutInput = z.infer<typeof createStockOutSchema>;
export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;
export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;
export type CreateProcessorReturnInput = z.infer<typeof createProcessorReturnSchema>;
export type StockMovementQueryInput = z.infer<typeof stockMovementQuerySchema>;
