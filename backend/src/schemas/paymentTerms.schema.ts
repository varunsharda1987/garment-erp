import { z } from 'zod';

/**
 * Create Payment Term Schema
 * POST /api/payment-terms
 */
export const createPaymentTermSchema = z.object({
  termCode: z
    .string()
    .min(1, 'Term code is required')
    .max(50, 'Term code must not exceed 50 characters')
    .trim(),
  termName: z
    .string()
    .min(1, 'Term name is required')
    .max(100, 'Term name must not exceed 100 characters')
    .trim(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  daysCount: z.number().int().nonnegative('Days count must be non-negative').optional().nullable(),
  discountPercent: z
    .number()
    .min(0, 'Discount percent must be at least 0')
    .max(100, 'Discount percent must not exceed 100')
    .optional()
    .nullable(),
  paymentSchedule: z.record(z.string(), z.any()).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Payment Term Schema
 * PUT /api/payment-terms/:id
 */
export const updatePaymentTermSchema = z.object({
  termCode: z
    .string()
    .min(1, 'Term code is required')
    .max(50, 'Term code must not exceed 50 characters')
    .trim()
    .optional(),
  termName: z
    .string()
    .min(1, 'Term name is required')
    .max(100, 'Term name must not exceed 100 characters')
    .trim()
    .optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  daysCount: z.number().int().nonnegative('Days count must be non-negative').optional().nullable(),
  discountPercent: z
    .number()
    .min(0, 'Discount percent must be at least 0')
    .max(100, 'Discount percent must not exceed 100')
    .optional()
    .nullable(),
  paymentSchedule: z.record(z.string(), z.any()).optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Payment Term Query Schema
 * GET /api/payment-terms
 */
export const paymentTermQuerySchema = z.object({
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
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true';
    })
    .pipe(z.boolean().optional()),
  sortBy: z.enum(['termCode', 'termName', 'daysCount', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Type exports
export type CreatePaymentTermInput = z.infer<typeof createPaymentTermSchema>;
export type UpdatePaymentTermInput = z.infer<typeof updatePaymentTermSchema>;
export type PaymentTermQueryInput = z.infer<typeof paymentTermQuerySchema>;
