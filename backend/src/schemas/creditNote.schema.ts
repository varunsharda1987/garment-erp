import { z } from 'zod';

/**
 * CreditNoteReason Enum - matches Prisma CreditNoteReason enum
 */
export const CreditNoteReasonEnum = z.enum([
  'SALES_RETURN',
  'RATE_DIFFERENCE',
  'QUALITY_ISSUE',
  'QUANTITY_DIFFERENCE',
  'OTHER',
]);

/**
 * DocumentStatus Enum - matches Prisma DocumentStatus enum
 */
export const DocumentStatusEnum = z.enum(['DRAFT', 'APPROVED', 'CANCELLED']);

/**
 * Credit Note Item Schema
 */
const creditNoteItemSchema = z.object({
  description: z
    .string()
    .min(1, 'Item description is required')
    .max(500, 'Description must not exceed 500 characters')
    .trim(),
  hsnCode: z.string().max(20).trim().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price must be at least 0'),
  gstRate: z.number().min(0).max(100).optional().nullable(),
});

/**
 * Create Credit Note Schema
 * POST /api/credit-notes
 */
export const createCreditNoteSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID format'),
  customerId: z.string().uuid('Invalid customer ID format'),
  creditNoteDate: z.string().optional().nullable(),
  reason: CreditNoteReasonEnum,
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').trim().optional().nullable(),
  items: z.array(creditNoteItemSchema).min(1, 'At least one item is required'),
});

/**
 * Credit Note Query Schema
 * GET /api/credit-notes
 */
export const creditNoteQuerySchema = z.object({
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
  status: DocumentStatusEnum.optional(),
  customerId: z.string().uuid('Invalid customer ID format').optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  sortBy: z.enum(['creditNoteNumber', 'creditNoteDate', 'totalAmount', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Type exports
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
export type CreditNoteQueryInput = z.infer<typeof creditNoteQuerySchema>;
export type CreditNoteReason = z.infer<typeof CreditNoteReasonEnum>;
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;
