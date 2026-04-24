/**
 * Embroidery Stock Validation Schemas
 *
 * Zod schemas for embroidery send-out/receive workflow.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// SEND-OUT SCHEMAS
// ============================================================================

/**
 * Send-Out Item
 */
// Helper for validating IDs that can be UUID or CUID
const isValidIdFormat = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val);

const sendOutItemSchema = z.object({
  // embroideryId accepts CUID (embroidery_master uses @default(cuid()))
  embroideryId: z.string().refine(isValidIdFormat, { message: 'Invalid embroidery ID (expected UUID or CUID)' }),
  styleId: z.string().uuid('Invalid style ID').optional(),
  // colorId accepts CUID (color_master uses @default(cuid()))
  colorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID (expected UUID or CUID)' }).optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('PCS'),
  remarks: z.string().max(500).optional(),
});

/**
 * Send Out Embroidery
 * POST /api/embroidery-stock/send-out
 */
export const sendOutSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  styleId: z.string().uuid('Invalid style ID').optional(),
  orderId: z.string().uuid('Invalid order ID').optional(),
  workOrderId: z.string().uuid('Invalid work order ID').optional(),
  challanNumber: z.string().max(50).optional(),
  sendDate: z.string().datetime().optional(),
  expectedReturnDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(sendOutItemSchema).min(1, 'At least one item is required'),
});

/**
 * Receive Embroidery
 * POST /api/embroidery-stock/receive
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
        receivedQuantity: z.number().nonnegative('Received quantity cannot be negative'),
        damagedQuantity: z.number().nonnegative().optional().default(0),
        shortQuantity: z.number().nonnegative().optional().default(0),
        qualityGrade: z.string().max(20).optional(),
        remarks: z.string().max(500).optional(),
      })
    )
    .min(1, 'At least one item is required'),
});

/**
 * Cancel Send-Out
 * POST /api/embroidery-stock/send-outs/:id/cancel
 */
export const cancelSendOutSchema = z.object({
  reason: z.string().max(500).min(1, 'Cancellation reason is required'),
  remarks: z.string().max(500).optional(),
});

/**
 * Embroidery Stock Query Params
 * GET /api/embroidery-stock/send-outs
 */
export const embroideryStockQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  processorId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED']).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SendOutInput = z.infer<typeof sendOutSchema>;
export type ReceiveInput = z.infer<typeof receiveSchema>;
export type CancelSendOutInput = z.infer<typeof cancelSendOutSchema>;
export type EmbroideryStockQueryInput = z.infer<typeof embroideryStockQuerySchema>;
