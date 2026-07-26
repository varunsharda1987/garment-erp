/**
 * TCS Validation Schemas
 *
 * Zod schemas for TCS (Tax Collected at Source) CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const TCSStatusEnum = z.enum(['PENDING', 'COLLECTED', 'DEPOSITED', 'FILED', 'CANCELLED']);

// ============================================================================
// TCS SCHEMAS
// ============================================================================

/**
 * Create TCS Record
 * POST /api/tcs
 *
 * Fields match the tcs_entries Prisma model, tcsService.create, and the
 * frontend CreateTCSRequest (frontend/src/types/tcs.types.ts).
 */
export const createTCSSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID').optional(),
  customerName: z.string().min(1, 'Customer name is required').max(200),
  tcsSection: z.string().min(1, 'TCS section is required').max(20),
  tcsRate: z.number().min(0).max(100, 'TCS rate must be between 0 and 100'),
  saleAmount: z.number().positive('Sale amount must be positive'),
  tcsAmount: z.number().nonnegative('TCS amount must be non-negative'),
  collectionDate: z.string().min(1, 'Collection date is required'),
  financialYear: z.string().min(1, 'Financial year is required').max(10),
  quarter: z.number().int().min(1).max(4),
  remarks: z.string().max(500).optional(),
});

/**
 * Update TCS Record
 * PUT /api/tcs/:id
 */
export const updateTCSSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID').optional().nullable(),
  customerName: z.string().min(1).max(200).optional(),
  tcsSection: z.string().min(1).max(20).optional(),
  tcsRate: z.number().min(0).max(100).optional(),
  saleAmount: z.number().positive().optional(),
  tcsAmount: z.number().nonnegative().optional(),
  collectionDate: z.string().min(1).optional(),
  financialYear: z.string().min(1).max(10).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Update TCS Status
 * PUT /api/tcs/:id/status
 */
export const updateTCSStatusSchema = z.object({
  status: TCSStatusEnum,
  challanNumber: z.string().max(50).optional(),
  challanDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Query TCS Records
 * GET /api/tcs
 */
export const tcsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  customerId: z.string().uuid().optional(),
  status: TCSStatusEnum.optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().max(100).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateTCSInput = z.infer<typeof createTCSSchema>;
export type UpdateTCSInput = z.infer<typeof updateTCSSchema>;
export type UpdateTCSStatusInput = z.infer<typeof updateTCSStatusSchema>;
export type TCSQueryInput = z.infer<typeof tcsQuerySchema>;
