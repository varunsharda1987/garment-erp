/**
 * Embroidery Stock Validation Schemas
 *
 * Zod schemas for embroidery send-out/receive workflow.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * Rewritten to mirror the actual controller contract (embroidery-stock.controller.ts /
 * embroidery-stock.service.ts DTOs) — the previous processorId/items[] shapes validated an
 * API that never existed, so POST /send-out and /receive always 400'd
 * (bug-hunt samples-embroidery-2/-13/-16).
 */

import { z } from 'zod';

// Helper for validating IDs that can be UUID or CUID
const isValidIdFormat = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val);

const cuidOrUuid = (label: string) =>
  z.string().refine(isValidIdFormat, { message: `Invalid ${label} (expected UUID or CUID)` });

// ============================================================================
// SEND-OUT SCHEMAS
// ============================================================================

/**
 * Send Out Fabric for Embroidery
 * POST /api/embroidery-stock/send-out
 *
 * Controller destructures: sourceFabricStockId, embroideryId, supplierId, quantitySent,
 * sentWidth, sendDate, expectedReturnDate, agreedRate, forStyleId, forOrderId, remarks
 */
export const sendOutSchema = z
  .object({
    sourceFabricStockId: z.string().uuid('Invalid fabric stock ID'),
    // embroideryId accepts CUID (embroidery_master uses @default(cuid()))
    embroideryId: cuidOrUuid('embroidery ID'),
    supplierId: z.string().uuid('Invalid supplier ID'),
    quantitySent: z.coerce.number().positive('Quantity sent must be positive'),
    sentWidth: z.coerce.number().positive('Sent width must be positive'),
    // z.coerce.date(): date pickers send YYYY-MM-DD, which z.string().datetime() rejects
    sendDate: z.coerce.date(),
    expectedReturnDate: z.coerce.date().optional(),
    agreedRate: z.coerce.number().positive('Agreed rate must be positive'),
    forStyleId: z.string().uuid('Invalid style ID').optional(),
    forOrderId: z.string().uuid('Invalid order ID').optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Receive Embroidered Fabric
 * POST /api/embroidery-stock/receive
 *
 * Controller destructures: sendOutId, quantityReceived, quantityDamaged, receivedWidth,
 * actualReturnDate, actualCost, invoiceNumber, invoiceDate, qualityGrade, warehouseLocation, remarks
 */
export const receiveSchema = z
  .object({
    sendOutId: z.string().uuid('Invalid send-out ID'),
    quantityReceived: z.coerce.number().positive('Quantity received must be positive'),
    quantityDamaged: z.coerce.number().nonnegative().optional(),
    receivedWidth: z.coerce.number().positive('Received width must be positive'),
    actualReturnDate: z.coerce.date(),
    actualCost: z.coerce.number().nonnegative().optional(),
    invoiceNumber: z.string().max(100).optional(),
    invoiceDate: z.coerce.date().optional(),
    qualityGrade: z.string().max(20).optional(),
    warehouseLocation: z.string().max(200).optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Cancel Send-Out
 * POST /api/embroidery-stock/send-outs/:id/cancel
 */
export const cancelSendOutSchema = z
  .object({
    reason: z.string().max(500).min(1, 'Cancellation reason is required'),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Embroidery Stock Query Params
 * GET /api/embroidery-stock/send-outs
 *
 * Status values match what the service actually writes (SENT / IN_PROGRESS /
 * PARTIALLY_RECEIVED / RECEIVED / CANCELLED); filter keys match the controller
 * (embroideryId, supplierId, forStyleId, forOrderId).
 */
export const embroideryStockQuerySchema = z.object({
  status: z.enum(['SENT', 'IN_PROGRESS', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
  embroideryId: cuidOrUuid('embroidery ID').optional(),
  supplierId: z.string().uuid().optional(),
  forStyleId: z.string().uuid().optional(),
  forOrderId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SendOutInput = z.infer<typeof sendOutSchema>;
export type ReceiveInput = z.infer<typeof receiveSchema>;
export type CancelSendOutInput = z.infer<typeof cancelSendOutSchema>;
export type EmbroideryStockQueryInput = z.infer<typeof embroideryStockQuerySchema>;
