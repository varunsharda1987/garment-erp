/**
 * Fabric & Greige Stock Validation Schemas
 *
 * Zod schemas for fabric-stock and greige-stock endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import {
  StockStatusEnum as PrismaStockStatusEnum,
  StockEntryTypeEnum as PrismaStockEntryTypeEnum,
} from './generated/prisma-enums';
import { formNumber, formNumberRequired } from './common.schema';

// ============================================================================
// Enums
// ============================================================================

// Status enum for fabric stock entries (matches Prisma StockStatus)
export const FabricStockStatusEnum = PrismaStockStatusEnum;

// Stock type enum for fabric stock entries (matches Prisma StockEntryType)
export const FabricStockTypeEnum = PrismaStockEntryTypeEnum;

// Quality grade enum
// BUG-GR9 fix: Default 'A' matches DEFAULT_QUALITY_GRADE in constants/stock.constants.ts
// and system_settings.DEFAULT_QUALITY_GRADE - these should be kept in sync
export const QualityGradeEnum = z.enum(['A', 'B', 'DEFECT']);

// Legacy enums - now aligned with Prisma to prevent runtime errors
// Prisma StockStatus: AVAILABLE, RESERVED, EXHAUSTED, ISSUED, PENDING_RETURN
export const StockStatusEnum = PrismaStockStatusEnum;

// Prisma StockEntryType: GENERIC, PLANNED_STOCK, EXCESS, EXCESS_MOQ, CROSS_STYLE_REUSE, RETURNED, VARIANCE_UNUSED
export const StockEntryTypeEnum = PrismaStockEntryTypeEnum;

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
 * Correct a lot's width (lot-width.helper)
 * POST /api/stock/:id/correct-width
 * The measured width is what the fabric really is; the cutable width defaults to measured − selvedge.
 */
export const correctLotWidthSchema = z.object({
  measuredWidthInches: formNumberRequired(z.number().positive('Enter the measured width').max(200)),
  cutableWidthInches: formNumber(z.number().positive().max(200)),
  reason: z.string().trim().min(3, 'Say why the width is being corrected').max(500),
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
  purchaseCost: z.number().nonnegative().optional().nullable(),
  weightedAvgCost: z.number().nonnegative().optional().nullable(),
  qualityGrade: z.string().max(20).optional().nullable(),
  warehouseLocation: z.string().max(255).optional().nullable(),
  rollNumbers: z.string().max(500).optional().nullable(),
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

/** One counted piece — a than (optionally in a bale) or a roll — as the Record / Check dialogs post it. */
const lotPieceRowSchema = z.object({
  // Bale-wise: the dialog's bale 1, 2, 3… (the server numbers them past the lot's own bales)
  baleNumber: formNumber(z.number().int().positive()),
  baleNo: z.string().trim().max(30).optional().nullable(), // printed bale number
  thanNo: z.string().trim().max(30).optional().nullable(), // than tag, or the roll number
  // COUNTED metres (the tag figure at the lot's fold length)
  meters: formNumberRequired(z.number().positive('Every piece needs its metres').max(100000)),
});

const pieceEntryModeSchema = z.enum(['THAN_WISE', 'BALE_WISE', 'ROLL_WISE']);

/**
 * Record the bales / thans / rolls of a greige lot that has no list ("Record bales & thans")
 * POST /api/greige/stock/:stockId/pieces
 */
export const recordGreigePiecesSchema = z
  .object({
    entryMode: pieceEntryModeSchema,
    pieces: z.array(lotPieceRowSchema).min(1, 'Count at least one piece').max(2000),
    remarks: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.entryMode !== 'BALE_WISE' || v.pieces.every((p) => p.baleNumber != null), {
    message: 'Bale-wise: every than needs its bale',
    path: ['pieces'],
  });

/**
 * Record / Check the rolls & thans of a finished-fabric lot
 * POST /api/stock/:id/pieces
 * Record: a lot with no list (or none left) — `pieces` only. Check: `keepPieceIds` = the listed pieces that
 * are really on the rack (every other listed piece leaves the list), plus any new `pieces`.
 */
export const recordFabricPiecesSchema = z
  .object({
    entryMode: pieceEntryModeSchema,
    keepPieceIds: z.array(z.string().uuid()).max(2000).default([]),
    pieces: z.array(lotPieceRowSchema).max(2000).default([]),
    remarks: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.entryMode !== 'BALE_WISE' || v.pieces.every((p) => p.baleNumber != null), {
    message: 'Bale-wise: every than needs its bale',
    path: ['pieces'],
  })
  .refine((v) => v.keepPieceIds.length > 0 || v.pieces.length > 0, {
    message: 'Tick a roll / than that is on the rack, or add one',
    path: ['pieces'],
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

export type RecordFabricPiecesInput = z.infer<typeof recordFabricPiecesSchema>;
export type CorrectLotWidthInput = z.infer<typeof correctLotWidthSchema>;

export type CreateGreigeStockInput = z.infer<typeof createGreigeStockSchema>;
export type UpdateGreigeStockInput = z.infer<typeof updateGreigeStockSchema>;
export type AdjustGreigeStockInput = z.infer<typeof adjustGreigeStockSchema>;
export type GreigeStockQueryInput = z.infer<typeof greigeStockQuerySchema>;
