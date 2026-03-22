import { z } from 'zod';

/**
 * DebitNoteReason Enum - matches Prisma DebitNoteReason enum
 */
export const DebitNoteReasonEnum = z.enum([
  'PURCHASE_RETURN',
  'RATE_DIFFERENCE',
  'QUALITY_ISSUE',
  'QUANTITY_SHORT',
  'DAMAGED_GOODS',
  'OTHER',
]);

/**
 * DocumentStatus Enum - matches Prisma DocumentStatus enum
 */
export const DebitNoteDocumentStatusEnum = z.enum([
  'DRAFT',
  'APPROVED',
  'CANCELLED',
]);

/**
 * Debit Note Item Schema
 */
const debitNoteItemSchema = z.object({
  description: z
    .string()
    .min(1, 'Item description is required')
    .max(500, 'Description must not exceed 500 characters')
    .trim(),
  hsnCode: z.string().max(20).trim().optional().nullable(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price must be at least 0'),
  gstRate: z.number().min(0).max(100).optional().nullable(),
});

/**
 * Create Debit Note Schema
 * POST /api/debit-notes
 */
export const createDebitNoteSchema = z.object({
  poId: z.string().uuid('Invalid PO ID format').optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID format'),
  debitNoteDate: z.string().optional().nullable(),
  reason: DebitNoteReasonEnum,
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').trim().optional().nullable(),
  items: z
    .array(debitNoteItemSchema)
    .min(1, 'At least one item is required'),
});

/**
 * Debit Note Query Schema
 * GET /api/debit-notes
 */
export const debitNoteQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(1000, 'Limit must not exceed 1000')),
  search: z.string().trim().optional(),
  status: DebitNoteDocumentStatusEnum.optional(),
  supplierId: z.string().uuid('Invalid supplier ID format').optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  sortBy: z.enum(['debitNoteNumber', 'debitNoteDate', 'totalAmount', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Type exports
export type CreateDebitNoteInput = z.infer<typeof createDebitNoteSchema>;
export type DebitNoteQueryInput = z.infer<typeof debitNoteQuerySchema>;
export type DebitNoteReason = z.infer<typeof DebitNoteReasonEnum>;
