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
  orderId: z.string().uuid('Invalid order ID format'),

  customerId: z.string().uuid('Invalid customer ID format'),

  // z.coerce.date() (not z.string().datetime()): the InvoiceForm date pickers send YYYY-MM-DD, which
  // .datetime() rejects — invoice creation from the UI 400'd on every call (bug-hunt financial-gst-4).
  invoiceDate: z.coerce.date().optional(),

  dueDate: z.coerce.date(),

  subtotal: z
    .number()
    .nonnegative('Subtotal must be non-negative')
    .max(100000000, 'Subtotal cannot exceed 10 crore')
    .or(z.string().transform((val) => parseFloat(val))),

  // taxAmount/totalAmount are auto-calculated by the service (per-item when `items` are supplied,
  // otherwise from subtotal + taxRate), so they're optional — don't force client figures the server
  // overwrites. And `items`/`taxRate`/`placeOfSupplyId` MUST be declared here: they were absent, so
  // validateBody stripped them and every API invoice got zero line items + header-only (often wrong)
  // GST (bug-hunt F5 — the per-item GST + invoice_items path was dead via the API).
  taxAmount: z
    .number()
    .nonnegative('Tax amount must be non-negative')
    .or(z.string().transform((val) => parseFloat(val)))
    .optional(),

  taxRate: z.number().nonnegative('Tax rate must be non-negative').max(100, 'Tax rate cannot exceed 100%').optional(),

  totalAmount: z
    .number()
    .positive('Total amount must be positive')
    .max(100000000, 'Total amount cannot exceed 10 crore')
    .or(z.string().transform((val) => parseFloat(val)))
    .optional(),

  placeOfSupplyId: z.string().uuid('Invalid place of supply ID format').optional(),

  items: z
    .array(
      z.object({
        styleId: z.string().uuid('Invalid style ID format').optional(),
        description: z.string().min(1, 'Item description is required'),
        hsnCode: z.string().optional(),
        quantity: z
          .number()
          .positive('Quantity must be positive')
          .max(1000000, 'Quantity cannot exceed 10 lakh units')
          .or(z.string().transform((val) => parseFloat(val))),
        unitPrice: z
          .number()
          .nonnegative('Unit price must be non-negative')
          .max(10000000, 'Unit price cannot exceed 1 crore')
          .or(z.string().transform((val) => parseFloat(val))),
        remarks: z.string().optional(),
      })
    )
    .optional(),

  remarks: z.string().max(500, 'Remarks must be less than 500 characters').trim().optional(),
});

/**
 * Update invoice request schema
 * PUT /api/invoices/:id
 */
export const updateInvoiceSchema = z.object({
  invoiceDate: z.coerce.date().optional(),

  dueDate: z.coerce.date().optional(),

  subtotal: z
    .number()
    .nonnegative('Subtotal must be non-negative')
    .max(100000000, 'Subtotal cannot exceed 10 crore')
    .or(z.string().transform((val) => parseFloat(val)))
    .optional(),

  taxAmount: z
    .number()
    .nonnegative('Tax amount must be non-negative')
    .max(50000000, 'Tax amount cannot exceed 5 crore')
    .or(z.string().transform((val) => parseFloat(val)))
    .optional(),

  totalAmount: z
    .number()
    .positive('Total amount must be positive')
    .max(100000000, 'Total amount cannot exceed 10 crore')
    .or(z.string().transform((val) => parseFloat(val)))
    .optional(),

  remarks: z.string().max(500, 'Remarks must be less than 500 characters').trim().optional(),
});

/**
 * P7.4: Create invoice from delivery note
 * POST /api/invoices/from-delivery-note
 */
export const createFromDeliveryNoteSchema = z.object({
  deliveryNoteId: z.string().uuid('Invalid delivery note ID format'),
  dueDate: z.coerce.date(),
  invoiceDate: z.coerce.date().optional(),
  remarks: z.string().max(500, 'Remarks must be less than 500 characters').trim().optional(),
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

  paymentDate: z.coerce.date().optional(),

  paymentMethod: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI'], {
    message: 'Invalid payment method',
  }),

  referenceNumber: z.string().max(100, 'Reference number must be less than 100 characters').trim().optional(),

  remarks: z.string().max(500, 'Remarks must be less than 500 characters').trim().optional(),
});

/**
 * Invoice query parameters schema
 * GET /api/invoices
 */
export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),

  limit: z.coerce.number().int().min(1).max(1000).optional().default(10),

  search: z.string().optional(),

  status: z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']).optional(),

  customerId: z.string().uuid('Invalid customer ID format').optional(),

  orderId: z.string().uuid('Invalid order ID format').optional(),

  fromDate: z.coerce.date().optional(),

  toDate: z.coerce.date().optional(),

  sortBy: z
    .enum(['createdAt', 'updatedAt', 'invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount', 'status'])
    .optional()
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Invoice ID parameter schema
 * For validating :id route parameters
 */
export const invoiceIdParamSchema = z.object({
  id: z.string().uuid('Invalid invoice ID format'),
});

// Type exports for TypeScript
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
export type InvoiceIdParam = z.infer<typeof invoiceIdParamSchema>;
