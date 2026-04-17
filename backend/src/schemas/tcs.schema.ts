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
 */
export const createTCSSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID').optional(),
  invoiceId: z.string().uuid('Invalid invoice ID').optional(),
  collectionDate: z.string().datetime().optional(),
  grossAmount: z.number().positive('Gross amount must be positive'),
  tcsRate: z.number().min(0).max(100, 'TCS rate must be between 0 and 100'),
  tcsAmount: z.number().nonnegative('TCS amount must be non-negative'),
  netAmount: z.number().positive('Net amount must be positive'),
  panNumber: z.string().max(20).optional(),
  tanNumber: z.string().max(20).optional(),
  challanNumber: z.string().max(50).optional(),
  challanDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update TCS Record
 * PUT /api/tcs/:id
 */
export const updateTCSSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID').optional().nullable(),
  invoiceId: z.string().uuid('Invalid invoice ID').optional().nullable(),
  collectionDate: z.string().datetime().optional().nullable(),
  grossAmount: z.number().positive().optional(),
  tcsRate: z.number().min(0).max(100).optional(),
  tcsAmount: z.number().nonnegative().optional(),
  netAmount: z.number().positive().optional(),
  panNumber: z.string().max(20).optional().nullable(),
  tanNumber: z.string().max(20).optional().nullable(),
  challanNumber: z.string().max(50).optional().nullable(),
  challanDate: z.string().datetime().optional().nullable(),
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
