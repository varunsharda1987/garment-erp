/**
 * Production Validation Schemas
 *
 * Zod schemas for cutting, stitching, and finishing endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Common Enums
// ============================================================================

export const CuttingBatchStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']);

export const StitchingIssueStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']);

export const FinishingIssueStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'PACKING', 'COMPLETED']);

// ============================================================================
// CUTTING SCHEMAS
// ============================================================================

/**
 * SKU Output for Cutting Batch
 */
export const skuOutputSchema = z.object({
  colorId: z.string().uuid().optional().nullable(),
  sizeId: z.string().uuid('Invalid size ID'),
  orderQty: z.number().int().nonnegative().optional(),
  extraAllowed: z.number().int().nonnegative().optional(),
  maxCuttable: z.number().int().nonnegative().optional(),
  toCut: z.number().int().nonnegative().optional(),
  plannedQty: z.number().int().nonnegative().optional(),
  cutQuantity: z.number().int().nonnegative().optional(),
});

/**
 * Additional Fabric Stock for Cutting
 */
export const fabricStockInputSchema = z.object({
  fabricStockId: z.string().uuid('Invalid fabric stock ID'),
  cadAvgUsed: z.number().positive().optional().nullable(),
  cadWidthUsed: z.number().positive().optional().nullable(),
  actualWidth: z.number().positive().optional().nullable(),
});

/**
 * Create Cutting Batch
 * POST /api/cutting/batches
 */
export const createCuttingBatchSchema = z.object({
  workOrderId: z.string().uuid('Invalid work order ID'),
  componentId: z.string().uuid('Invalid component ID').optional(),
  cuttingDate: z.string().or(z.date()),
  fabricStockId: z.string().uuid('Invalid fabric stock ID'),
  actualFabricWidth: z.number().positive().optional(),
  cadAverageUsed: z.number().positive('CAD average must be positive'),
  cadWidthUsed: z.number().positive().optional(),
  layersPerLay: z.number().int().positive().optional(),
  numberOfLays: z.number().int().positive().optional(),
  cuttingTableId: z.string().uuid().optional(),
  cuttingOperatorId: z.string().uuid().optional(),
  remarks: z.string().max(1000).optional(),
  skuOutputs: z.array(skuOutputSchema).min(1, 'At least one SKU output is required'),
  fabricStocks: z.array(fabricStockInputSchema).optional(),
});

/**
 * Update Cutting Batch
 * PUT /api/cutting/batches/:id
 */
export const updateCuttingBatchSchema = z.object({
  cuttingDate: z.string().or(z.date()).optional(),
  actualFabricWidth: z.number().positive().optional(),
  cadAverageUsed: z.number().positive().optional(),
  cadWidthUsed: z.number().positive().optional(),
  layersPerLay: z.number().int().positive().optional(),
  numberOfLays: z.number().int().positive().optional(),
  cuttingTableId: z.string().uuid().optional().nullable(),
  cuttingOperatorId: z.string().uuid().optional().nullable(),
  remarks: z.string().max(1000).optional(),
});

/**
 * Record Cutting Output
 * POST /api/cutting/batches/:id/record-output
 */
export const recordCuttingOutputSchema = z.object({
  skuOutputs: z
    .array(
      z.object({
        skuId: z.string().uuid('Invalid SKU ID'),
        cutQty: z.number().int().nonnegative(),
        rejectedQty: z.number().int().nonnegative().optional(),
        goodPcs: z.number().int().nonnegative().optional(),
      })
    )
    .min(1, 'At least one SKU output is required'),
  fabricConsumed: z.number().nonnegative().optional(),
  remarks: z.string().max(1000).optional(),
});

/**
 * Add Cutting Lay
 * POST /api/cutting/batches/:id/lays
 */
export const addCuttingLaySchema = z.object({
  layNumber: z.number().int().positive(),
  layDate: z.string().or(z.date()),
  layLength: z.number().positive(),
  noOfPlies: z.number().int().positive(),
  fabricUsed: z.number().positive(),
  remarks: z.string().max(500).optional(),
});

/**
 * Issue to Stitching
 * POST /api/cutting/batches/:id/issue-to-stitching
 */
export const issueToStitchingSchema = z.object({
  skuIssues: z
    .array(
      z.object({
        skuId: z.string().uuid('Invalid SKU ID'),
        quantity: z.number().int().positive('Quantity must be positive'),
      })
    )
    .min(1, 'At least one SKU issue is required'),
  remarks: z.string().max(1000).optional(),
});

/**
 * Complete Cutting Batch
 * POST /api/cutting/batches/:id/complete
 */
export const completeCuttingBatchSchema = z.object({
  fabricConsumed: z.number().nonnegative().optional(),
  remarks: z.string().max(1000).optional(),
  fabricReturns: z
    .array(
      z.object({
        fabricStockId: z.string().uuid('Invalid fabric stock ID'),
        returnQuantity: z.number().positive('Return quantity must be positive'),
      })
    )
    .optional(),
});

/**
 * Hold/Cancel Batch
 * POST /api/cutting/batches/:id/hold or /cancel
 */
export const batchActionSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

// ============================================================================
// STITCHING SCHEMAS
// ============================================================================

/**
 * Create Stitching Issue
 * POST /api/stitching/issues
 */
export const createStitchingIssueSchema = z.object({
  workOrderId: z.string().uuid('Invalid work order ID'),
  transferSlipId: z.string().uuid('Invalid transfer slip ID').optional(),
  managerId: z.string().uuid('Invalid manager ID').optional(),
  startDate: z.string().or(z.date()).optional(),
  remarks: z.string().max(1000).optional(),
  skuQuantities: z
    .array(
      z.object({
        colorId: z.string().uuid().optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        issuedQty: z.number().int().positive('Quantity must be positive'),
      })
    )
    .optional(),
});

/**
 * Update Stitching Issue
 * PUT /api/stitching/issues/:id
 */
export const updateStitchingIssueSchema = z.object({
  managerId: z.string().uuid().optional().nullable(),
  remarks: z.string().max(1000).optional(),
});

/**
 * Receive from Cutting
 * POST /api/stitching/issues/:id/receive
 */
export const receiveFromCuttingSchema = z.object({
  receivedQty: z.number().int().positive('Quantity must be positive'),
  remarks: z.string().max(500).optional(),
});

/**
 * Record Daily Stitching Output
 * POST /api/stitching/issues/:id/daily-output
 */
export const recordStitchingOutputSchema = z.object({
  outputDate: z.string().or(z.date()),
  skuOutputs: z
    .array(
      z.object({
        colorId: z.string().uuid().optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        goodQty: z.number().int().nonnegative(),
        defectQty: z.number().int().nonnegative().optional(),
        rejectedQty: z.number().int().nonnegative().optional(),
      })
    )
    .min(1, 'At least one SKU output is required'),
  remarks: z.string().max(1000).optional(),
});

/**
 * Dispose Defects
 * POST /api/stitching/issues/:id/dispose-defects
 */
export const disposeDefectsSchema = z.object({
  skuDisposals: z
    .array(
      z.object({
        colorId: z.string().uuid().optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        quantity: z.number().int().positive('Quantity must be positive'),
        disposalType: z.enum(['RECTIFIED', 'REJECTED', 'REWORK']),
      })
    )
    .min(1, 'At least one disposal is required'),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// FINISHING SCHEMAS
// ============================================================================

/**
 * Create Finishing Issue
 * POST /api/finishing/issues
 */
export const createFinishingIssueSchema = z.object({
  workOrderId: z.string().uuid('Invalid work order ID'),
  transferSlipId: z.string().uuid('Invalid transfer slip ID').optional(),
  managerId: z.string().uuid('Invalid manager ID').optional(),
  startDate: z.string().or(z.date()).optional(),
  remarks: z.string().max(1000).optional(),
  skuQuantities: z
    .array(
      z.object({
        colorId: z.string().uuid().optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        issuedQty: z.number().int().positive('Quantity must be positive'),
      })
    )
    .optional(),
});

/**
 * Update Finishing Issue
 * PUT /api/finishing/issues/:id
 */
export const updateFinishingIssueSchema = z.object({
  managerId: z.string().uuid().optional().nullable(),
  remarks: z.string().max(1000).optional(),
});

/**
 * Receive from Stitching
 * POST /api/finishing/issues/:id/receive
 */
export const receiveFromStitchingSchema = z.object({
  receivedQty: z.number().int().positive('Quantity must be positive'),
  remarks: z.string().max(500).optional(),
});

/**
 * Record Daily Finishing Output
 * POST /api/finishing/issues/:id/record-output
 */
export const recordFinishingOutputSchema = z.object({
  outputDate: z.string().or(z.date()),
  skuOutputs: z
    .array(
      z.object({
        colorId: z.string().uuid().optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        goodQty: z.number().int().nonnegative(),
        defectQty: z.number().int().nonnegative().optional(),
        rejectedQty: z.number().int().nonnegative().optional(),
      })
    )
    .min(1, 'At least one SKU output is required'),
  remarks: z.string().max(1000).optional(),
});

/**
 * Polybag Entry
 * POST /api/finishing/issues/:id/polybag-entry
 */
export const polybagEntrySchema = z.object({
  skuPackings: z
    .array(
      z.object({
        colorId: z.string().uuid().optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        quantity: z.number().int().positive('Quantity must be positive'),
        polybagSize: z.string().max(50).optional(),
      })
    )
    .min(1, 'At least one packing is required'),
  remarks: z.string().max(500).optional(),
});

/**
 * Carton Packing
 * POST /api/finishing/issues/:id/carton-packing
 */
export const cartonPackingSchema = z.object({
  cartonNumber: z.string().max(50),
  packingDate: z.string().or(z.date()),
  skuContents: z
    .array(
      z.object({
        colorId: z.string().uuid().optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        quantity: z.number().int().positive('Quantity must be positive'),
      })
    )
    .min(1, 'At least one SKU is required'),
  grossWeight: z.number().positive().optional(),
  netWeight: z.number().positive().optional(),
  dimensions: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * Cutting Batch Query Params
 */
export const cuttingBatchQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  status: CuttingBatchStatusEnum.optional(),
  workOrderId: z.string().uuid().optional(),
  componentId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

/**
 * Stitching Issue Query Params
 */
export const stitchingIssueQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  status: StitchingIssueStatusEnum.optional(),
  workOrderId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
});

/**
 * Finishing Issue Query Params
 */
export const finishingIssueQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  status: FinishingIssueStatusEnum.optional(),
  workOrderId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateCuttingBatchInput = z.infer<typeof createCuttingBatchSchema>;
export type UpdateCuttingBatchInput = z.infer<typeof updateCuttingBatchSchema>;
export type RecordCuttingOutputInput = z.infer<typeof recordCuttingOutputSchema>;
export type AddCuttingLayInput = z.infer<typeof addCuttingLaySchema>;
export type IssueToStitchingInput = z.infer<typeof issueToStitchingSchema>;
export type CompleteCuttingBatchInput = z.infer<typeof completeCuttingBatchSchema>;

export type CreateStitchingIssueInput = z.infer<typeof createStitchingIssueSchema>;
export type UpdateStitchingIssueInput = z.infer<typeof updateStitchingIssueSchema>;
export type RecordStitchingOutputInput = z.infer<typeof recordStitchingOutputSchema>;
export type DisposeDefectsInput = z.infer<typeof disposeDefectsSchema>;

export type CreateFinishingIssueInput = z.infer<typeof createFinishingIssueSchema>;
export type UpdateFinishingIssueInput = z.infer<typeof updateFinishingIssueSchema>;
export type RecordFinishingOutputInput = z.infer<typeof recordFinishingOutputSchema>;
export type PolybagEntryInput = z.infer<typeof polybagEntrySchema>;
export type CartonPackingInput = z.infer<typeof cartonPackingSchema>;
