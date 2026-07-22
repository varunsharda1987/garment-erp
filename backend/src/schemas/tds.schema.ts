/**
 * TDS Validation Schemas
 *
 * Zod schemas for TDS (Tax Deducted at Source) CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * Rewritten (bug-hunt financial-gst-2/-3): the old schema described a model that never existed
 * (vendorId/section/panNumber/challanNumber...) while the frontend and Prisma tds_entries agreed on
 * deductorName/deducteeName/tdsSection/..., and TDSStatusEnum had invented statuses — so POST /api/tds
 * could never succeed and status updates 400'd. These schemas now mirror the Prisma model exactly.
 */

import { z } from 'zod';

// ============================================================================
// Enums — MUST mirror Prisma TDSStatus exactly
// ============================================================================

export const TDSStatusEnum = z.enum(['PENDING', 'CERTIFICATE_RECEIVED', 'VERIFIED']);

// ============================================================================
// TDS SCHEMAS
// ============================================================================

/**
 * Create TDS Record
 * POST /api/tds
 * Mirrors tds_entries columns; service spreads this straight into prisma.tds_entries.create.
 */
export const createTDSSchema = z
  .object({
    invoiceId: z.string().uuid('Invalid invoice ID').optional(),
    paymentId: z.string().uuid('Invalid payment ID').optional(),
    deductorName: z.string().min(1, 'Deductor name is required').max(200),
    deducteeName: z.string().min(1, 'Deductee name is required').max(200),
    tdsSection: z.string().min(1, 'TDS section is required').max(20),
    tdsRate: z.number().min(0).max(100, 'TDS rate must be between 0 and 100'),
    grossAmount: z.number().positive('Gross amount must be positive'),
    tdsAmount: z.number().nonnegative('TDS amount must be non-negative'),
    netAmount: z.number().positive('Net amount must be positive'),
    certificateNo: z.string().max(100).optional(),
    deductionDate: z.coerce.date(),
    financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Financial year must be like 2025-26'),
    quarter: z.number().int().min(1).max(4),
    remarks: z.string().max(500).optional(),
  })
  .refine((d) => Math.abs(d.tdsAmount - (d.grossAmount * d.tdsRate) / 100) < 1, {
    message: 'tdsAmount must equal grossAmount × tdsRate / 100 (±1 rounding tolerance)',
    path: ['tdsAmount'],
  })
  .refine((d) => Math.abs(d.netAmount - (d.grossAmount - d.tdsAmount)) < 0.01, {
    message: 'netAmount must equal grossAmount − tdsAmount',
    path: ['netAmount'],
  });

/**
 * Update TDS Record
 * PUT /api/tds/:id
 */
export const updateTDSSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID').optional().nullable(),
  paymentId: z.string().uuid('Invalid payment ID').optional().nullable(),
  deductorName: z.string().min(1).max(200).optional(),
  deducteeName: z.string().min(1).max(200).optional(),
  tdsSection: z.string().min(1).max(20).optional(),
  tdsRate: z.number().min(0).max(100).optional(),
  grossAmount: z.number().positive().optional(),
  tdsAmount: z.number().nonnegative().optional(),
  netAmount: z.number().positive().optional(),
  certificateNo: z.string().max(100).optional().nullable(),
  deductionDate: z.coerce.date().optional(),
  financialYear: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Update TDS Status
 * PUT /api/tds/:id/status
 * Controller reads { status, certificateNo } — certificateNo MUST be declared or validateBody strips it.
 */
export const updateTDSStatusSchema = z.object({
  status: TDSStatusEnum,
  certificateNo: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Query TDS Records
 * GET /api/tds
 */
export const tdsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  financialYear: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  status: TDSStatusEnum.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['deductionDate', 'createdAt', 'grossAmount', 'tdsAmount', 'financialYear']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateTDSInput = z.infer<typeof createTDSSchema>;
export type UpdateTDSInput = z.infer<typeof updateTDSSchema>;
export type UpdateTDSStatusInput = z.infer<typeof updateTDSStatusSchema>;
export type TDSQueryInput = z.infer<typeof tdsQuerySchema>;
