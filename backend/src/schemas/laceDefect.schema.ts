/**
 * Lace Defect Validation Schemas
 *
 * Zod schemas for lace defect tracking and claims.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const DefectTypeEnum = z.enum([
  'WEAVING_FAULT',
  'DYEING_FAULT',
  'FINISHING_FAULT',
  'PATTERN_FAULT',
  'CONTAMINATION',
  'DIMENSIONAL',
  'OTHER',
]);

export const ClaimStatusEnum = z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RESOLVED']);

// ============================================================================
// LACE DEFECT SCHEMAS
// ============================================================================

/**
 * Log a New Defect
 * POST /api/lace-defects
 */
export const logDefectSchema = z.object({
  stockId: z.string().uuid('Invalid stock ID'),
  laceId: z.string().uuid('Invalid lace ID'),
  defectType: DefectTypeEnum,
  defectQuantity: z.number().positive('Defect quantity must be positive'),
  discoveredAt: z.string().datetime().optional(),
  orderId: z.string().uuid('Invalid order ID').optional(),
  styleId: z.string().uuid('Invalid style ID').optional(),
  defectDescription: z.string().max(1000).optional(),
  photos: z.array(z.string().url()).optional(),
});

/**
 * Submit Claim
 * POST /api/lace-defects/:id/claim/submit
 */
export const submitClaimSchema = z.object({
  claimReference: z.string().min(1, 'Claim reference is required').max(100),
  claimAmount: z.number().nonnegative('Claim amount must be non-negative'),
  notes: z.string().max(1000).optional(),
});

/**
 * Update Claim Status
 * PUT /api/lace-defects/:id/claim/status
 */
export const updateClaimStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'RESOLVED']),
  resolution: z.string().max(1000).optional(),
});

/**
 * Record Replacement
 * POST /api/lace-defects/:id/replacement
 */
export const recordReplacementSchema = z.object({
  replacementStockId: z.string().uuid('Invalid replacement stock ID'),
  replacementQuantity: z.number().positive('Replacement quantity must be positive'),
});

/**
 * Query Defects
 * GET /api/lace-defects
 */
export const laceDefectQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  stockId: z.string().uuid().optional(),
  laceId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  defectType: DefectTypeEnum.optional(),
  claimStatus: ClaimStatusEnum.optional(),
  discoveredAt: z.string().optional(),
  search: z.string().max(100).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type LogDefectInput = z.infer<typeof logDefectSchema>;
export type SubmitClaimInput = z.infer<typeof submitClaimSchema>;
export type UpdateClaimStatusInput = z.infer<typeof updateClaimStatusSchema>;
export type RecordReplacementInput = z.infer<typeof recordReplacementSchema>;
export type LaceDefectQueryInput = z.infer<typeof laceDefectQuerySchema>;
