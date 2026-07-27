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

// Mirror of Prisma enum ExternalProcessType (schema.prisma:9579-9583): EMBROIDERY_PIECE | SMOCKING | HANDWORK.
export const ExternalProcessTypeEnum = z.enum(['EMBROIDERY_PIECE', 'SMOCKING', 'HANDWORK']);

// Mirror of Prisma enum ExternalProcessStatus (schema.prisma:9591-9597): DRAFT | SENT | PARTIALLY_RECEIVED | RECEIVED | CANCELLED.
export const SendOutStatusEnum = z.enum(['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']);

// ============================================================================
// EXTERNAL PROCESS SCHEMAS
// ============================================================================

/**
 * Source Type for external processing
 */
export const SourceTypeEnum = z.enum(['CUTTING_BATCH', 'FABRIC_STOCK', 'STITCHING_ISSUE']);

/**
 * SKU Output for send-out
 * Matches SendOutSkuDTO in external-process.service.ts ({ colorId?, sizeId, sentQty }).
 */
const sendOutSkuSchema = z.object({
  colorId: z.string().uuid().optional(),
  sizeId: z.string().uuid(),
  sentQty: z.number().int().positive(),
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
 * Matches ReceiveDTO.skus in external-process.service.ts ({ sendOutSkuId, receivedQty, damagedQty }).
 */
const receiveSkuSchema = z.object({
  sendOutSkuId: z.string().uuid(),
  receivedQty: z.number().int().nonnegative(),
  // default 0 so the service's goodQty = receivedQty - damagedQty never yields NaN if a caller omits it
  damagedQty: z.number().int().nonnegative().default(0),
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
