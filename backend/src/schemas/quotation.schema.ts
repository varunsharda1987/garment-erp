/**
 * Quotation Validation Schemas
 * Zod schemas for validating quotation-related requests
 */

import { z } from 'zod';

/**
 * Quotation item schema
 * Used for creating/updating quotation line items
 */
const quotationItemSchema = z.object({
  styleId: z.string().uuid('Invalid style ID format'),

  description: z.string().max(500, 'Description must be less than 500 characters').trim().optional(),

  totalQuantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than 0')
    .or(z.string().transform((val) => parseInt(val, 10))),

  unitPrice: z
    .number()
    .nonnegative('Unit price must be non-negative')
    .or(z.string().transform((val) => parseFloat(val))),

  deliveryDays: z
    .number()
    .int('Delivery days must be an integer')
    .min(0, 'Delivery days must be at least 0')
    .max(365, 'Delivery days must be at most 365')
    .optional()
    .or(z.string().transform((val) => (val ? parseInt(val, 10) : undefined))),

  remarks: z.string().max(500, 'Remarks must be less than 500 characters').trim().optional(),
});

/**
 * Create quotation request schema
 * POST /api/quotations
 */
export const createQuotationSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),

  quotationDate: z
    .string()
    .datetime('Invalid date format')
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),

  validUntil: z
    .string()
    .datetime('Invalid date format')
    .transform((val) => new Date(val)),

  remarks: z.string().max(1000, 'Remarks must be less than 1000 characters').trim().optional(),

  termsAndConditions: z.string().max(5000, 'Terms and conditions must be less than 5000 characters').trim().optional(),

  items: z.array(quotationItemSchema).min(1, 'Quotation must have at least one item'),
});

/**
 * Update quotation request schema
 * PUT /api/quotations/:id
 */
export const updateQuotationSchema = z.object({
  quotationDate: z
    .string()
    .datetime('Invalid date format')
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),

  validUntil: z
    .string()
    .datetime('Invalid date format')
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),

  remarks: z.string().max(1000, 'Remarks must be less than 1000 characters').trim().optional(),

  termsAndConditions: z.string().max(5000, 'Terms and conditions must be less than 5000 characters').trim().optional(),

  items: z.array(quotationItemSchema).min(1, 'Quotation must have at least one item').optional(),

  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
});

/**
 * Update quotation status request schema
 * PUT /api/quotations/:id/status
 */
export const updateQuotationStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']),
});

/**
 * Quotation query parameters schema
 * GET /api/quotations
 */
export const quotationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),

  limit: z.coerce.number().int().min(1).max(1000).optional().default(10),

  search: z.string().optional(),

  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),

  customerId: z.string().uuid('Invalid customer ID format').optional(),

  fromDate: z.string().datetime('Invalid date format').optional(),

  toDate: z.string().datetime('Invalid date format').optional(),

  sortBy: z.string().optional().default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Quotation ID parameter schema
 * For validating :id route parameters
 */
export const quotationIdParamSchema = z.object({
  id: z.string().uuid('Invalid quotation ID format'),
});

// Type exports for TypeScript
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type UpdateQuotationStatusInput = z.infer<typeof updateQuotationStatusSchema>;
export type QuotationQueryInput = z.infer<typeof quotationQuerySchema>;
export type QuotationIdParam = z.infer<typeof quotationIdParamSchema>;
export type QuotationItemInput = z.infer<typeof quotationItemSchema>;
