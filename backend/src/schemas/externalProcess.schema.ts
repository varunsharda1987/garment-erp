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
 * Send Out Item
 */
const sendOutItemSchema = z.object({
  cuttingOutputId: z.string().uuid('Invalid cutting output ID').optional(),
  skuId: z.string().uuid('Invalid SKU ID').optional(),
  bundleNo: z.string().max(50).optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  remarks: z.string().max(500).optional(),
});

/**
 * Send Out
 * POST /api/external-process/send-out
 */
export const sendOutSchema = z.object({
  workOrderId: z.string().uuid('Invalid work order ID'),
  processorId: z.string().uuid('Invalid processor ID'),
  processType: ExternalProcessTypeEnum,
  sendDate: z.string().datetime().optional(),
  expectedReturnDate: z.string().datetime().optional(),
  challanNumber: z.string().max(50).optional(),
  ratePerPc: z.number().nonnegative().optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(sendOutItemSchema).min(1, 'At least one item is required'),
});

/**
 * Receive
 * POST /api/external-process/receive
 */
export const receiveSchema = z.object({
  sendOutId: z.string().uuid('Invalid send-out ID'),
  receiveDate: z.string().datetime().optional(),
  challanNumber: z.string().max(50).optional(),
  remarks: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        sendOutItemId: z.string().uuid('Invalid send-out item ID'),
        receivedQuantity: z.number().int().nonnegative('Received quantity cannot be negative'),
        damagedQuantity: z.number().int().nonnegative().optional().default(0),
        shortQuantity: z.number().int().nonnegative().optional().default(0),
        qualityGrade: z.string().max(20).optional(),
        remarks: z.string().max(500).optional(),
      })
    )
    .min(1, 'At least one item is required'),
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
