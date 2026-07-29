import { z } from 'zod';
import { UnitEnum } from './common.schema';

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
 * Processing QC Data Schema (for PROCESSING PO GRN approval)
 */
const processingQCSchema = z
  .object({
    qtyReceivedMeters: z.number().nonnegative().optional(),
    receivedWidthInches: z.number().positive().optional(),
    thanCount: z.number().int().nonnegative().optional(),
    foldLengthCm: z.number().nonnegative().optional(),
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

// Type exports for use in controllers
export type CreateGRNInput = z.infer<typeof createGRNSchema>;
export type ApproveGRNInput = z.infer<typeof approveGRNSchema>;
export type RejectGRNInput = z.infer<typeof rejectGRNSchema>;
