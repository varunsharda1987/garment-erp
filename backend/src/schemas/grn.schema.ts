import { z } from 'zod';

/**
 * Unit Enum - matches Prisma Unit
 */
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
]);

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
  rejectionReason: z
    .string()
    .max(500, 'Rejection reason must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
  remarks: z
    .string()
    .max(500, 'Remarks must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * Processing Receive Data Schema (for PROCESSING PO GRNs)
 */
const processingDataSchema = z.object({
  qtyReceivedMeters: z.number().nonnegative().optional(),
  receivedWidthInches: z.number().positive('Received width must be positive'),
  thanCount: z.number().int().nonnegative().optional(),
  foldLengthCm: z.number().nonnegative().optional(),
  receivedChallan: z
    .string()
    .max(100, 'Received challan must not exceed 100 characters')
    .trim()
    .optional(),
});

/**
 * Create GRN Schema
 * POST /api/grn
 */
export const createGRNSchema = z.object({
  poId: z.string().min(1, 'Purchase Order ID is required'),
  warehouseId: z.string().optional().nullable(),
  receivingDate: z.string().optional(),
  invoiceNumber: z
    .string()
    .max(100, 'Invoice number must not exceed 100 characters')
    .trim()
    .optional()
    .nullable(),
  invoiceDate: z.string().optional().nullable(),
  transportDetails: z
    .string()
    .max(500, 'Transport details must not exceed 500 characters')
    .trim()
    .optional()
    .nullable(),
  remarks: z
    .string()
    .max(1000, 'Remarks must not exceed 1000 characters')
    .trim()
    .optional()
    .nullable(),
  items: z
    .array(grnItemSchema)
    .min(1, 'At least one item is required'),
  processingData: processingDataSchema.optional(),
});

// Type exports for use in controllers
export type CreateGRNInput = z.infer<typeof createGRNSchema>;
