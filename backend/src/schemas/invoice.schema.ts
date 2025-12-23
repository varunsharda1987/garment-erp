/**
 * Invoice Validation Schemas
 * Zod schemas for validating invoice-related requests
 */

import { z } from 'zod';

/**
 * Create invoice request schema
 * POST /api/invoices
 */
export const createInvoiceSchema = z.object({
  orderId: z
    .string()
    .uuid('Invalid order ID format'),

  customerId: z
    .string()
    .uuid('Invalid customer ID format'),

  invoiceDate: z
    .string()
    .datetime('Invalid date format')
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),

  dueDate: z
    .string()
    .datetime('Invalid date format')
    .transform((val) => new Date(val)),

  subtotal: z
    .number()
    .nonnegative('Subtotal must be non-negative')
    .or(z.string().transform((val) => parseFloat(val))),

  taxAmount: z
    .number()
    .nonnegative('Tax amount must be non-negative')
    .or(z.string().transform((val) => parseFloat(val))),

  totalAmount: z
    .number()
    .positive('Total amount must be positive')
    .or(z.string().transform((val) => parseFloat(val))),

  remarks: z
    .string()
    .max(500, 'Remarks must be less than 500 characters')
    .trim()
    .optional(),
});

/**
 * Update invoice request schema
 * PUT /api/invoices/:id
 */
export const updateInvoiceSchema = z.object({
  invoiceDate: z
    .string()
    .datetime('Invalid date format')
    .transform((val) => new Date(val))
    .optional(),

  dueDate: z
    .string()
    .datetime('Invalid date format')
    .transform((val) => new Date(val))
    .optional(),

  subtotal: z
    .number()
    .nonnegative('Subtotal must be non-negative')
    .or(z.string().transform((val) => parseFloat(val)))
    .optional(),

  taxAmount: z
    .number()
    .nonnegative('Tax amount must be non-negative')
    .or(z.string().transform((val) => parseFloat(val)))
    .optional(),

  totalAmount: z
    .number()
    .positive('Total amount must be positive')
    .or(z.string().transform((val) => parseFloat(val)))
    .optional(),

  remarks: z
    .string()
    .max(500, 'Remarks must be less than 500 characters')
    .trim()
    .optional(),
});

/**
 * Record payment request schema
 * POST /api/invoices/:id/payments
 */
export const recordPaymentSchema = z.object({
  amount: z
    .number()
    .positive('Payment amount must be positive')
    .or(z.string().transform((val) => parseFloat(val))),

  paymentDate: z
    .string()
    .datetime('Invalid date format')
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),

  paymentMethod: z
    .enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI'], {
      message: 'Invalid payment method',
    }),

  referenceNumber: z
    .string()
    .max(100, 'Reference number must be less than 100 characters')
    .trim()
    .optional(),

  remarks: z
    .string()
    .max(500, 'Remarks must be less than 500 characters')
    .trim()
    .optional(),
});

/**
 * Invoice query parameters schema
 * GET /api/invoices
 */
export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),

  limit: z.coerce.number().int().min(1).max(1000).optional().default(10),

  search: z
    .string()
    .optional(),

  status: z
    .enum(['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'])
    .optional(),

  customerId: z
    .string()
    .uuid('Invalid customer ID format')
    .optional(),

  orderId: z
    .string()
    .uuid('Invalid order ID format')
    .optional(),

  fromDate: z
    .string()
    .datetime('Invalid from date format')
    .optional(),

  toDate: z
    .string()
    .datetime('Invalid to date format')
    .optional(),

  sortBy: z
    .string()
    .optional()
    .default('createdAt'),

  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
});

/**
 * Invoice ID parameter schema
 * For validating :id route parameters
 */
export const invoiceIdParamSchema = z.object({
  id: z
    .string()
    .uuid('Invalid invoice ID format'),
});

// Type exports for TypeScript
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
export type InvoiceIdParam = z.infer<typeof invoiceIdParamSchema>;
