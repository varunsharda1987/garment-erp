import { z } from 'zod';
import { UnitEnum, formNumber } from './common.schema';

/**
 * Unit Enum - shared full Prisma-aligned enum (includes PAIR/PACK/GRAM/LITER/ROLL).
 */
export { UnitEnum };

/**
 * Entry mode for GRN items (FABRIC & GREIGE)
 */
const entryModeEnum = z.enum(['TOTAL_METERS', 'THAN_WISE', 'BALE_WISE', 'ROLL_WISE']);

/**
 * Detail row schema for than/roll breakdown
 */
const grnItemDetailSchema = z.object({
  detailType: z.enum(['THAN', 'ROLL']),
  baleNumber: z.number().int().positive().optional().nullable(),
  sequenceNo: z.number().int().nonnegative(),
  meters: z.number().positive('Meters must be positive'),
  remarks: z.string().max(500).trim().optional().nullable(),
});

/**
 * GRN Item Schema
 */
const grnItemSchema = z.object({
  poItemId: z.string().min(1, 'PO Item ID is required'),
  materialId: z.string().min(1, 'Material ID is required'),
  receivedQuantity: z.number().nonnegative('Received quantity must be 0 or greater'),
  acceptedQuantity: z.number().nonnegative('Accepted quantity must be 0 or greater'),
  rejectedQuantity: z.number().nonnegative('Rejected quantity must be 0 or greater'),
  unit: UnitEnum,
  rejectionReason: z.string().max(500, 'Rejection reason must not exceed 500 characters').trim().optional().nullable(),
  remarks: z.string().max(500, 'Remarks must not exceed 500 characters').trim().optional().nullable(),
  // Per-item measurement fields (FABRIC & GREIGE)
  foldLengthCm: z.number().nonnegative().optional().nullable(),
  receivedWidthInches: z.number().nonnegative().optional().nullable(),
  entryMode: entryModeEnum.optional().nullable(),
  // Greige "received as ready fabric" override (GRNForm sends these for GREIGE POs and
  // grn.service.ts:200-202 persists them). They were missing here, so Zod stripped all three and the
  // service always stored false/null/false: the override never applied, the actual received rate was
  // never captured (weighted-average cost kept using the PO rate) and future-sourcing was never updated.
  receivedAsReadyFabric: z.boolean().optional(),
  actualRatePerUnit: z.coerce.number().nonnegative().optional().nullable(),
  updateFutureSourcing: z.boolean().optional(),
  details: z.array(grnItemDetailSchema).optional(),
});

/**
 * Processing Receive Data Schema (for PROCESSING PO GRNs)
 */
const processingDataSchema = z.object({
  qtyReceivedMeters: z.number().nonnegative().optional(),
  receivedWidthInches: z.number().positive('Received width must be positive'),
  thanCount: z.number().int().nonnegative().optional(),
  foldLengthCm: z.number().nonnegative().optional(),
  receivedChallan: z.string().max(100, 'Received challan must not exceed 100 characters').trim().optional(),
});

/**
 * Create GRN Schema
 * POST /api/grn
 */
export const createGRNSchema = z
  .object({
    poId: z.string().min(1, 'Purchase Order ID is required'),
    warehouseId: z.string().optional().nullable(),
    receivingDate: z.string().optional(),
    invoiceNumber: z.string().max(100, 'Invoice number must not exceed 100 characters').trim().optional().nullable(),
    invoiceDate: z.string().optional().nullable(),
    transportDetails: z
      .string()
      .max(500, 'Transport details must not exceed 500 characters')
      .trim()
      .optional()
      .nullable(),
    remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').trim().optional().nullable(),
    items: z.array(grnItemSchema).min(1, 'At least one item is required'),
    processingData: processingDataSchema.optional(),
  })
  .passthrough();

/**
 * POST /api/grn/jwo/receive — the one action that records a job-work return (2026-09-19).
 *
 * The only door for processed material coming back from a processor: the receipt is filed already
 * ACCEPTED and the stock lot, inward challan, loss split and MRP advance are booked in the same
 * transaction. The create-only POST /api/grn/jwo (a receipt with no stock behind it) is a 410.
 *
 * Entry modes:
 * - TOTAL_METERS: qtyReceivedMeters, or thanCount × foldLengthCm
 * - THAN_WISE: Array of thans with meters (unbaled)
 * - BALE_WISE: Array of thans grouped by baleNumber
 */
export const receiveJwoToStockSchema = z.object({
  jobWorkOrderId: z.string().uuid('Invalid Job Work Order ID'),
  // Numeric fields use formNumber(): optional and nullable by construction, '' → null. This is a
  // form-fed schema and the strict-number ratchet is right to insist on it.
  qtyReceivedMeters: formNumber(z.number().positive()),
  receivedWidthInches: formNumber(z.number().positive()),
  thanCount: formNumber(z.number().int().positive()),
  // Every foldLengthCm column is Decimal(5,2): anything ≥ 1000 overflows in Postgres and surfaced as
  // a masked 500 (found 2026-09-15 by jwo-fabric-receive). Refuse it here with a readable message.
  foldLengthCm: formNumber(z.number().positive().max(999.99, 'Fold length is in cm and must be under 1000')),
  receivedChallan: z.string().max(100).trim().optional(),
  // The date the goods actually came back (defaults to today) — becomes the receipt date, the job's
  // receivedDate and the inward challan date.
  receivedDate: z.string().optional().nullable(),
  invoiceNumber: z.string().max(100).trim().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  // Required up front: the stock lot is written in the same call.
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  // Receiving in parts: a non-final receipt books its lot and challan and leaves the job
  // PARTIALLY_RECEIVED; the final one runs the loss split on the cumulative total and closes the
  // return. Defaults to true so a lone full receipt behaves as before.
  isFinal: z.boolean().optional().default(true),
  // A receipt that closes the job while the total is short beyond the tolerance is a SHORT CLOSE and
  // must say so explicitly; without this the server refuses it (2026-09-19 — the first real receipt
  // closed DJ-ESSKY085LS-002 at half the expected metres by an unintended tick).
  shortCloseConfirmed: z.boolean().optional().default(false),
  remarks: z.string().max(1000).trim().optional().nullable(),
  // Entry mode for bale/than tracking (same modes as regular GRN)
  entryMode: entryModeEnum.optional().nullable(),
  // Detail rows for THAN_WISE / BALE_WISE entry modes
  details: z.array(grnItemDetailSchema).optional(),
  // Declared explicitly: processingQCSchema below never names these and they only survive through
  // .passthrough(), the silent-stripping class the smart-check exists to catch.
  processingQC: z
    .object({
      qualityGrade: z.enum(['A', 'B', 'Reject']).optional(),
      defectMeters: formNumber(z.number().nonnegative()),
    })
    .optional(),
});

/**
 * Processing QC Data Schema (for PROCESSING PO GRN approval)
 */
// Form-fed (the GRN approve dialog): formNumber() accepts '' and strings. The trailing transform maps
// formNumber's null back to undefined so the legacy PROCESSING-PO branch sees exactly what it always did.
const blankToUndefined = (v: number | null | undefined) => v ?? undefined;
const processingQCSchema = z
  .object({
    qtyReceivedMeters: formNumber(z.number().nonnegative()).transform(blankToUndefined),
    receivedWidthInches: formNumber(z.number().positive()).transform(blankToUndefined),
    thanCount: formNumber(z.number().int().nonnegative()).transform(blankToUndefined),
    foldLengthCm: formNumber(z.number().nonnegative()).transform(blankToUndefined),
    receivedChallan: z.string().max(100).optional(),
  })
  .passthrough();

/**
 * Approve GRN Schema
 * PATCH /api/grn/:id/approve
 */
export const approveGRNSchema = z
  .object({
    warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
    processingQC: processingQCSchema.optional(),
  })
  .passthrough();

/**
 * Reject GRN Schema
 * PATCH /api/grn/:id/reject
 */
export const rejectGRNSchema = z
  .object({
    reason: z.string().min(1, 'Rejection reason is required').max(500),
    remarks: z.string().max(1000).optional(),
  })
  .passthrough();

// BUG-GRN6 fix: Reverse GRN Schema for full reversal of accepted GRNs
/**
 * Reverse GRN Schema
 * PATCH /api/grn/:id/reverse
 */
export const reverseGRNSchema = z
  .object({
    reason: z.string().min(1, 'Reversal reason is required').max(500, 'Reversal reason must not exceed 500 characters'),
  })
  .passthrough();

/**
 * GRN Query Params Schema
 * GET /api/grn
 *
 * Controller destructures: poId, supplierId, status, search, startDate, endDate, page, limit, sortBy, sortOrder
 */
export const grnQuerySchema = z.object({
  poId: z.string().uuid('Invalid PO ID').optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  // BUG-GRN6 fix: Added REVERSED status to query schema
  status: z
    .enum(['PENDING', 'PENDING_QC', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'REVERSED', 'PARTIALLY_ACCEPTED'])
    .optional(),
  search: z.string().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Type exports for use in controllers
export type CreateGRNInput = z.infer<typeof createGRNSchema>;
export type ApproveGRNInput = z.infer<typeof approveGRNSchema>;
export type RejectGRNInput = z.infer<typeof rejectGRNSchema>;
export type ReverseGRNInput = z.infer<typeof reverseGRNSchema>; // BUG-GRN6 fix
export type GRNQueryInput = z.infer<typeof grnQuerySchema>;
