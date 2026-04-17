/**
 * TDS Validation Schemas
 *
 * Zod schemas for TDS (Tax Deducted at Source) CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const TDSStatusEnum = z.enum(['PENDING', 'DEDUCTED', 'DEPOSITED', 'FILED', 'CANCELLED']);

// ============================================================================
// TDS SCHEMAS
// ============================================================================

/**
 * Create TDS Record
 * POST /api/tds
 */
export const createTDSSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor ID').optional(),
  invoiceId: z.string().uuid('Invalid invoice ID').optional(),
  paymentId: z.string().uuid('Invalid payment ID').optional(),
  section: z.string().min(1, 'Section is required').max(20),
  deductionDate: z.string().datetime().optional(),
  grossAmount: z.number().positive('Gross amount must be positive'),
  tdsRate: z.number().min(0).max(100, 'TDS rate must be between 0 and 100'),
  tdsAmount: z.number().nonnegative('TDS amount must be non-negative'),
  netAmount: z.number().positive('Net amount must be positive'),
  panNumber: z.string().max(20).optional(),
  tanNumber: z.string().max(20).optional(),
  challanNumber: z.string().max(50).optional(),
  challanDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update TDS Record
 * PUT /api/tds/:id
 */
export const updateTDSSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor ID').optional().nullable(),
  invoiceId: z.string().uuid('Invalid invoice ID').optional().nullable(),
  paymentId: z.string().uuid('Invalid payment ID').optional().nullable(),
  section: z.string().min(1).max(20).optional(),
  deductionDate: z.string().datetime().optional().nullable(),
  grossAmount: z.number().positive().optional(),
  tdsRate: z.number().min(0).max(100).optional(),
  tdsAmount: z.number().nonnegative().optional(),
  netAmount: z.number().positive().optional(),
  panNumber: z.string().max(20).optional().nullable(),
  tanNumber: z.string().max(20).optional().nullable(),
  challanNumber: z.string().max(50).optional().nullable(),
  challanDate: z.string().datetime().optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Update TDS Status
 * PUT /api/tds/:id/status
 */
export const updateTDSStatusSchema = z.object({
  status: TDSStatusEnum,
  challanNumber: z.string().max(50).optional(),
  challanDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Query TDS Records
 * GET /api/tds
 */
export const tdsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  vendorId: z.string().uuid().optional(),
  section: z.string().max(20).optional(),
  status: TDSStatusEnum.optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().max(100).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateTDSInput = z.infer<typeof createTDSSchema>;
export type UpdateTDSInput = z.infer<typeof updateTDSSchema>;
export type UpdateTDSStatusInput = z.infer<typeof updateTDSStatusSchema>;
export type TDSQueryInput = z.infer<typeof tdsQuerySchema>;
