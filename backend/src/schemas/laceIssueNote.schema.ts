/**
 * Lace Issue Note Validation Schemas
 *
 * Zod schemas for lace issue notes management.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

// BUG-LC4 FIX: Aligned with Prisma lace_issue_note.status values
export const IssueNoteStatusEnum = z.enum(['ISSUED', 'PARTIALLY_RETURNED', 'CLOSED']);

// ============================================================================
// LACE ISSUE NOTE SCHEMAS
// ============================================================================

/**
 * Create Issue Note
 * POST /api/lace-issue-notes
 */
export const createIssueNoteSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  styleId: z.string().uuid('Invalid style ID'),
  stockId: z.string().uuid('Invalid stock ID'),
  laceId: z.string().uuid('Invalid lace ID'),
  issuedQuantity: z.number().positive('Issued quantity must be positive'),
  cuttingBatchId: z.string().uuid('Invalid cutting batch ID').optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Record Consumption
 * POST /api/lace-issue-notes/:id/consume
 */
export const recordConsumptionSchema = z.object({
  consumedQuantity: z.number().positive('Consumed quantity must be positive'),
  notes: z.string().max(1000).optional(),
});

/**
 * Return to Stock
 * POST /api/lace-issue-notes/:id/return
 */
export const returnToStockSchema = z.object({
  returnQuantity: z.number().positive('Return quantity must be positive'),
  notes: z.string().max(1000).optional(),
});

/**
 * Query Issue Notes
 * GET /api/lace-issue-notes
 */
export const issueNoteQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  orderId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  stockId: z.string().uuid().optional(),
  laceId: z.string().uuid().optional(),
  status: IssueNoteStatusEnum.optional(),
  search: z.string().max(100).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateIssueNoteInput = z.infer<typeof createIssueNoteSchema>;
export type RecordConsumptionInput = z.infer<typeof recordConsumptionSchema>;
export type ReturnToStockInput = z.infer<typeof returnToStockSchema>;
export type IssueNoteQueryInput = z.infer<typeof issueNoteQuerySchema>;
