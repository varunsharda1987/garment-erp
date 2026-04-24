/**
 * External Process Validation Schemas
 *
 * Zod schemas for smocking, handwork, and piece-level embroidery tracking.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ExternalProcessTypeEnum = z.enum([
  'SMOCKING',
  'HANDWORK',
  'PIECE_EMBROIDERY',
  'APPLIQUE',
  'BEADING',
  'OTHER',
]);

export const SendOutStatusEnum = z.enum(['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED']);

// ============================================================================
// EXTERNAL PROCESS SCHEMAS
// ============================================================================

/**
 * Source Type for external processing
 */
export const SourceTypeEnum = z.enum(['CUTTING_BATCH', 'FABRIC_STOCK', 'STITCHING_ISSUE']);

/**
 * SKU Output for send-out
 */
const sendOutSkuSchema = z.object({
  sizeId: z.string().uuid().optional(),
  sizeName: z.string(),
  colorId: z.string().uuid().optional(),
  quantity: z.number().int().nonnegative(),
});

/**
 * Send Out
 * POST /api/external-process/send-out
 */
export const sendOutSchema = z.object({
  sourceType: SourceTypeEnum,
  workOrderId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  cuttingBatchId: z.string().uuid().optional(),
  fabricStockId: z.string().uuid().optional(),
  stitchingIssueId: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  processType: ExternalProcessTypeEnum.optional(),
  sendDate: z.string().or(z.date()).optional(),
  expectedReturnDate: z.string().or(z.date()).optional(),
  quantitySent: z.number().positive(),
  unit: z.string().max(20),
  agreedRate: z.number().nonnegative().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  serviceRequirementId: z.string().uuid().optional(),
  embroideryId: z.string().uuid().optional(),
  skus: z.array(sendOutSkuSchema).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * SKU for receive
 */
const receiveSkuSchema = z.object({
  sendOutSkuId: z.string().uuid().optional(),
  sizeName: z.string(),
  quantityReceived: z.number().int().nonnegative(),
  quantityDamaged: z.number().int().nonnegative().optional(),
});

/**
 * Receive
 * POST /api/external-process/receive
 */
export const receiveSchema = z.object({
  sendOutId: z.string().uuid('Invalid send-out ID'),
  quantityReceived: z.number().nonnegative(),
  quantityDamaged: z.number().nonnegative().optional(),
  actualReturnDate: z.string().or(z.date()).optional(),
  actualCost: z.number().nonnegative().optional(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceDate: z.string().or(z.date()).optional(),
  skus: z.array(receiveSkuSchema).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Cancel Send Out
 * POST /api/external-process/send-outs/:id/cancel
 */
export const cancelSendOutSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
  remarks: z.string().max(500).optional(),
});

/**
 * External Process Query Params
 * GET /api/external-process/send-outs
 */
export const externalProcessQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  workOrderId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  processType: ExternalProcessTypeEnum.optional(),
  status: SendOutStatusEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SendOutInput = z.infer<typeof sendOutSchema>;
export type ReceiveInput = z.infer<typeof receiveSchema>;
export type CancelSendOutInput = z.infer<typeof cancelSendOutSchema>;
export type ExternalProcessQueryInput = z.infer<typeof externalProcessQuerySchema>;
