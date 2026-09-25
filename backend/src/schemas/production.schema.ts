/**
 * Production Validation Schemas
 *
 * Zod schemas for cutting, stitching, and finishing endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import {
  CuttingBatchStatusEnum as PrismaCuttingBatchStatusEnum,
  StitchingIssueStatusEnum as PrismaStitchingIssueStatusEnum,
  FinishingStatusEnum as PrismaFinishingStatusEnum,
} from './generated/prisma-enums';

// Helper for validating IDs that can be UUID or CUID (color_master uses CUID)
const isValidIdFormat = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val);

/**
 * A colour the DATABASE requires.
 *
 * `stitching_output_skus`, `finishing_output_skus`, `polybag_skus` and `carton_skus` all declare
 * `colorId` NOT NULL, but these schemas used to accept a missing or null one. The row then reached
 * Prisma and died as an opaque 500 — the operator saw "An unexpected error occurred" with no clue
 * which field, on a screen where nothing looked wrong. Same bug class, and same fix, as the
 * delivery-note and ASN lines in dispatch.schema.ts.
 *
 * ISSUE-side SKUs (stitching_issue_skus, finishing_issue_skus, cutting_batch_skus) are genuinely
 * nullable in the database and must stay optional here — do not "tidy" them to match.
 *
 * The message names the remedy: a colour reaches these screens from the style's Primary Color
 * (services/helpers/style-colour.helper.ts), so a style without one is the usual cause.
 */
const requiredColorId = z
  .string({
    error: 'Required — open the style and set its Primary Color, and it fills in here automatically.',
  })
  .refine(isValidIdFormat, { message: 'Invalid color ID' });

// ============================================================================
// Common Enums - imported from generated prisma-enums to ensure alignment
// ============================================================================

// Prisma CuttingBatchStatus: PENDING, IN_PROGRESS, COMPLETED, ON_HOLD (no CANCELLED)
export const CuttingBatchStatusEnum = PrismaCuttingBatchStatusEnum;

// Prisma StitchingIssueStatus: PENDING_RECEIPT, RECEIVED, IN_PROGRESS, COMPLETED
export const StitchingIssueStatusEnum = PrismaStitchingIssueStatusEnum;

// Prisma FinishingStatus: PENDING_RECEIPT, RECEIVED, IN_PROGRESS, PACKING, COMPLETED
export const FinishingIssueStatusEnum = PrismaFinishingStatusEnum;

// ============================================================================
// CUTTING SCHEMAS
// ============================================================================

/**
 * SKU Output for Cutting Batch
 */
export const skuOutputSchema = z.object({
  colorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional().nullable(),
  sizeId: z.string().uuid('Invalid size ID'),
  orderQty: z.number().int().nonnegative().optional(),
  extraAllowed: z.number().int().nonnegative().optional(),
  maxCuttable: z.number().int().nonnegative().optional(),
  toCut: z.number().int().nonnegative().optional(),
  plannedQty: z.number().int().nonnegative().optional(),
});

/**
 * Additional Fabric Stock for Cutting
 */
// The Cutting Chart page sends `|| 0` for a lot with no recorded width or CAD figure; 0 means
// "not known", never a value — the batch-level cadAverageUsed is the real gate (T4-B, 2026-09-17).
export const fabricStockInputSchema = z.object({
  fabricStockId: z.string().uuid('Invalid fabric stock ID'),
  cadAvgUsed: z.number().nonnegative().optional().nullable(),
  cadWidthUsed: z.number().nonnegative().optional().nullable(),
  actualWidth: z.number().nonnegative().optional().nullable(),
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
  // The Cutting Chart page (the designed path: Cutting → New Batch) creates the batch BEFORE any lay
  // is planned and sends layersPerLay/numberOfLays as 0, and a lot with no recorded width as 0.
  // `.positive()` (b0725786, 2026-04-17) refused all three, so every Create Batch from that page
  // answered "Invalid request data" — never noticed because nothing had reached cutting (order-system
  // T4-B, 2026-09-17). 0 = not yet known; the controller resolves the width from the lot.
  actualFabricWidth: z.number().nonnegative().optional(),
  cadAverageUsed: z.number().positive('CAD average must be positive'),
  cadWidthUsed: z.number().nonnegative().optional(),
  layersPerLay: z.number().int().nonnegative().optional(),
  numberOfLays: z.number().int().nonnegative().optional(),
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
export const recordCuttingOutputSchema = z
  .object({
    // Shape matches what the frontend sends (RecordCuttingOutputRequest: id?/colorId/sizeId/cutQty) and
    // what the controller reads. The old required 'skuId' was a field NOBODY sends → every record-output
    // call 400'd (bug-hunt production-3).
    skuOutputs: z
      .array(
        z
          .object({
            id: z.string().uuid('Invalid SKU row ID').optional(),
            colorId: z.string().nullable().optional(),
            sizeId: z.string().uuid('Invalid size ID'),
            cutQty: z.number().int().nonnegative(),
            rejectedQty: z.number().int().nonnegative().optional(),
            goodPcs: z.number().int().nonnegative().optional(),
          })
          .passthrough()
      )
      .min(1, 'At least one SKU output is required'),
    defects: z
      .array(
        z
          .object({
            defectType: z.string().max(100).optional(),
            quantity: z.number().int().nonnegative().optional(),
            description: z.string().max(500).optional(),
          })
          .passthrough()
      )
      .optional(),
    fabricConsumed: z.number().nonnegative().optional(),
    remarks: z.string().max(1000).optional(),
  })
  .passthrough();

/**
 * Add Cutting Lay
 * POST /api/cutting/batches/:id/lays
 */
/**
 * Save Lay on the batch page (CuttingDetail.tsx handleSaveLay) posts, per ticked size,
 * `{ colorId, sizeId, piecesPerLayer }` and, with more than one fabric, `fabricLengths[]` as
 * `{ cuttingBatchFabricId, layerLength }` — which is also exactly what cutting-lay.controller reads
 * and stores (cutting_lay_skus.sizeId / colorId, cutting_lay_fabrics.layerLength). This schema had
 * demanded a `sizeName` the page never sent (since 5ccbc1a0, 2026-04-24) and a per-fabric `length`
 * nobody wrote, so every Save Lay answered "Invalid request data" — found 2026-09-25 preparing the
 * first real lay on CB-WO2609-0087-002; no lay had ever been recorded. Post what the PAGE posts.
 */
export const addCuttingLaySchema = z.object({
  layDate: z.string().or(z.date()).optional(),
  numberOfLayers: z.number().int().positive(),
  layerLength: z.number().positive(),
  remarks: z.string().max(500).optional(),
  skuOutputs: z
    .array(
      z
        .object({
          colorId: z.string().uuid().nullable().optional(),
          sizeId: z.string().uuid(),
          sizeName: z.string().optional(),
          // Typed client only: CuttingDetail.tsx keeps layPieces as numbers (no free-text form field)
          piecesPerLayer: z.number().int().nonnegative().optional(), // allow-strict-number
          // legacy name for the same number
          pieces: z.number().int().nonnegative().optional(), // allow-strict-number
        })
        .refine((s) => s.piecesPerLayer != null || s.pieces != null, {
          message: 'piecesPerLayer is required for every size on the lay',
          path: ['piecesPerLayer'],
        })
    )
    .min(1, 'At least one size with pieces per layer is required')
    .optional(),
  fabricLengths: z
    .array(
      z.object({
        cuttingBatchFabricId: z.string().uuid(),
        layerLength: z.number().positive(),
      })
    )
    .optional(),
  cuttingBatchFabricId: z.string().uuid().optional(),
});

/**
 * Issue to Stitching
 * POST /api/cutting/batches/:id/issue-to-stitching
 */
export const issueToStitchingSchema = z
  .object({
    // Matches the frontend IssueToStitchingRequest ({colorId, sizeId, quantity}); the old required
    // 'skuId' was never sent → every issue-to-stitching call 400'd (bug-hunt production-3).
    skuOutputs: z
      .array(
        z
          .object({
            colorId: z.string().nullable().optional(),
            sizeId: z.string().uuid('Invalid size ID'),
            quantity: z.number().int().positive('Quantity must be positive'),
          })
          .passthrough()
      )
      .min(1, 'At least one SKU output is required'),
    issuedToId: z.string().uuid('Invalid issued-to ID').optional(),
    issueDate: z.string().or(z.date()).optional(),
    remarks: z.string().max(1000).optional(),
  })
  .passthrough();

/**
 * Complete Cutting Batch
 * POST /api/cutting/batches/:id/complete
 */
export const completeCuttingBatchSchema = z
  .object({
    fabricConsumed: z.number().nonnegative().optional(),
    actualAverage: z.number().positive().optional(),
    remarks: z.string().max(1000).optional(),
    fabricReturns: z
      .array(
        z
          .object({
            fabricStockId: z.string().uuid('Invalid fabric stock ID'),
            // 'returnedQuantity' — the name BOTH the controller (cutting.controller completeCuttingBatch)
            // and the frontend (cutting.types.ts) use; the old 'returnQuantity' meant the validated value
            // never reached the controller and fabric returns were silently 0 (bug-hunt production-2).
            returnedQuantity: z.number().positive('Return quantity must be positive'),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

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
  transferSlipIds: z.array(z.string().uuid('Invalid transfer slip ID')).optional(), // Changed from transferSlipId (string) to transferSlipIds (array)
  managerId: z.string().uuid('Invalid manager ID').optional(),
  contractorId: z.string().uuid('Invalid contractor ID').optional(), // Added - contractor assignment
  issueDate: z.string().or(z.date()).optional(), // Renamed from startDate
  expectedCompletionDate: z.string().or(z.date()).optional(), // Added - expected completion
  remarks: z.string().max(1000).optional(),
  components: z.array(z.string().uuid('Invalid component ID')).optional(), // Added - component assignment
  skuBreakdown: z // Renamed from skuQuantities
    .array(
      z.object({
        colorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        availableQty: z.number().int().nonnegative().optional(), // Added - from cutting output
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
  // Same as the finishing equivalent: real columns the controller converts and writes, previously
  // stripped so the dates could never be edited.
  issueDate: z.coerce.date().optional(),
  expectedCompletionDate: z.coerce.date().optional().nullable(),
});

/**
 * Receive from Cutting
 * POST /api/stitching/issues/:id/receive
 */
export const receiveFromCuttingSchema = z.object({
  // Optional: the controller guards on `if (transferSlipId)` and the UI's quick-receive omits it.
  // The pages must OMIT this field rather than send '' (empty string fails .uuid()).
  transferSlipId: z.string().uuid('Invalid transfer slip ID').optional(),
  // Optional: the controller guards on `if (skuReceived?.length && userId)`; the list-page
  // quick-receive sends nothing while the detail page sends the received breakdown.
  skuReceived: z
    .array(
      z.object({
        colorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        receivedQty: z.number().int().nonnegative(),
      })
    )
    .optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Record Daily Stitching Output
 * POST /api/stitching/issues/:id/daily-output
 */
export const recordStitchingOutputSchema = z.object({
  outputDate: z.string().or(z.date()),
  componentId: z.string().uuid('Invalid component ID').optional(),
  skuOutputs: z
    .array(
      z.object({
        // stitching_output_skus.colorId is NOT NULL — see requiredColorId above
        colorId: requiredColorId,
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
  // Must match the controller's contract (REWORK | SCRAP). The old ['RECTIFIED','REJECTED','REWORK']
  // enum made SCRAP unreachable and RECTIFIED/REJECTED 400 in the controller (bug-hunt production-13).
  disposition: z.enum(['REWORK', 'SCRAP']),
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
  managerId: z.string().uuid('Invalid manager ID').optional(),
  contractorId: z.string().uuid('Invalid contractor ID').optional(), // Added - contractor assignment
  issueDate: z.string().or(z.date()).optional(), // Renamed from startDate
  expectedCompletionDate: z.string().or(z.date()).optional(), // Added - expected completion
  remarks: z.string().max(1000).optional(),
  components: z.array(z.string().uuid('Invalid component ID')).optional(), // Added - component assignment
  skuBreakdown: z // Renamed from skuQuantities
    .array(
      z.object({
        colorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional().nullable(),
        sizeId: z.string().uuid('Invalid size ID'),
        availableQty: z.number().int().nonnegative().optional(), // Added - from stitching output
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
  // Real columns the controller explicitly converts and writes; they were absent here, so Zod
  // stripped them and the dates could never be edited.
  issueDate: z.coerce.date().optional(),
  expectedCompletionDate: z.coerce.date().optional().nullable(),
});

/**
 * Receive from Stitching
 * POST /api/finishing/issues/:id/receive
 */
export const receiveFromStitchingSchema = z
  .object({
    transferSlipId: z.string().uuid('Invalid transfer slip ID').optional(),
    // Optional: the controller guards on `if (receivedQty != null && userId)`. The detail page
    // derives this from the SKU breakdown; the list-page quick-receive omits it entirely.
    receivedQty: z.number().int().nonnegative().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Record Daily Finishing Output
 * POST /api/finishing/issues/:id/record-output
 */
export const recordFinishingOutputSchema = z
  .object({
    outputDate: z.string().or(z.date()),
    componentId: z.string().uuid('Invalid component ID').optional(),
    skuOutputs: z
      .array(
        z
          .object({
            // finishing_output_skus.colorId is NOT NULL — see requiredColorId above
            colorId: requiredColorId,
            sizeId: z.string().uuid('Invalid size ID'),
            finishedQty: z.number().int().nonnegative(),
            defectQty: z.number().int().nonnegative().optional(),
            rejectedQty: z.number().int().nonnegative().optional(),
          })
          .passthrough()
      )
      .min(1, 'At least one SKU output is required'),
    remarks: z.string().max(1000).optional(),
  })
  .passthrough();

/**
 * Polybag Entry
 * POST /api/finishing/issues/:id/polybag-entry
 */
export const polybagEntrySchema = z
  .object({
    packingDate: z.string().or(z.date()).optional(),
    skuBreakdown: z
      .array(
        z
          .object({
            // polybag_skus.colorId is NOT NULL — see requiredColorId above
            colorId: requiredColorId,
            sizeId: z.string().uuid('Invalid size ID'),
            packedQty: z.number().int().positive('Packed quantity must be positive'),
            polybagSize: z.string().max(50).optional(),
          })
          .passthrough()
      )
      .min(1, 'At least one packing is required'),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Carton Packing
 * POST /api/finishing/issues/:id/carton-packing
 */
export const cartonPackingSchema = z
  .object({
    cartonNumber: z.string().max(50),
    cartonDate: z.string().or(z.date()),
    packingType: z.string().max(50).optional(),
    skuBreakdown: z
      .array(
        z
          .object({
            // carton_skus.colorId is NOT NULL — see requiredColorId above
            colorId: requiredColorId,
            sizeId: z.string().uuid('Invalid size ID'),
            quantity: z.number().int().positive('Quantity must be positive'),
          })
          .passthrough()
      )
      .min(1, 'At least one SKU is required'),
    grossWeight: z.number().positive().optional(),
    netWeight: z.number().positive().optional(),
    cartonDimensions: z.string().max(100).optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

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
