/**
 * Dispatch Module Validation Schemas
 *
 * Zod schemas for delivery-notes and ASN endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const DeliveryNoteStatusEnum = z.enum([
  'DRAFT',
  'CONFIRMED',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
]);

export const ASNStatusEnum = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'RESCHEDULED', 'CANCELLED']);

// ============================================================================
// DELIVERY NOTE SCHEMAS
// ============================================================================

/**
 * Delivery Note Item
 */
const deliveryNoteItemSchema = z.object({
  orderId: z.string().uuid('Invalid order ID').optional(),
  orderItemId: z.string().uuid('Invalid order item ID').optional(),
  styleId: z.string().uuid('Invalid style ID').optional(),
  variantId: z.string().uuid('Invalid variant ID').optional(),
  skuId: z.string().uuid('Invalid SKU ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  cartonCount: z.number().int().nonnegative().optional(),
  grossWeight: z.number().nonnegative().optional(),
  netWeight: z.number().nonnegative().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Create Delivery Note
 * POST /api/dispatch/delivery-notes
 */
export const createDeliveryNoteSchema = z.object({
  orderId: z.string().uuid('Invalid order ID').optional(),
  customerId: z.string().uuid('Invalid customer ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  transporterId: z.string().uuid('Invalid transporter ID').optional(),
  vehicleNumber: z.string().max(50).optional(),
  driverName: z.string().max(100).optional(),
  driverContact: z.string().max(20).optional(),
  dispatchDate: z.string().datetime().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  deliveryAddress: z.string().max(500).optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(deliveryNoteItemSchema).min(1, 'At least one item is required'),
});

/**
 * Update Delivery Note
 * PUT /api/dispatch/delivery-notes/:id
 */
export const updateDeliveryNoteSchema = z.object({
  transporterId: z.string().uuid('Invalid transporter ID').optional().nullable(),
  vehicleNumber: z.string().max(50).optional().nullable(),
  driverName: z.string().max(100).optional().nullable(),
  driverContact: z.string().max(20).optional().nullable(),
  dispatchDate: z.string().datetime().optional().nullable(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  actualDeliveryDate: z.string().datetime().optional().nullable(),
  deliveryAddress: z.string().max(500).optional().nullable(),
  status: DeliveryNoteStatusEnum.optional(),
  remarks: z.string().max(500).optional().nullable(),
  items: z.array(deliveryNoteItemSchema).optional(),
});

/**
 * Delivery Note Query Params
 * GET /api/dispatch/delivery-notes
 */
export const deliveryNoteQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  transporterId: z.string().uuid().optional(),
  status: DeliveryNoteStatusEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

/**
 * Delivery Note Action (Confirm/Dispatch/Deliver/Cancel)
 * POST /api/dispatch/delivery-notes/:id/confirm, dispatch, deliver, cancel
 */
export const deliveryNoteActionSchema = z.object({
  remarks: z.string().max(500).optional(),
  actualDeliveryDate: z.string().datetime().optional(),
  receivedBy: z.string().max(100).optional(),
  proofOfDelivery: z.string().max(500).optional(),
});

// ============================================================================
// ASN (ADVANCE SHIPPING NOTICE) SCHEMAS
// ============================================================================

/**
 * ASN Item
 */
const asnItemSchema = z.object({
  deliveryNoteItemId: z.string().uuid('Invalid delivery note item ID').optional(),
  styleId: z.string().uuid('Invalid style ID').optional(),
  variantId: z.string().uuid('Invalid variant ID').optional(),
  skuId: z.string().uuid('Invalid SKU ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  cartonCount: z.number().int().nonnegative().optional(),
  ssccCode: z.string().max(50).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Create ASN
 * POST /api/dispatch/asn
 */
export const createASNSchema = z.object({
  deliveryNoteId: z.string().uuid('Invalid delivery note ID').optional(),
  orderId: z.string().uuid('Invalid order ID').optional(),
  customerId: z.string().uuid('Invalid customer ID'),
  shipFromWarehouseId: z.string().uuid('Invalid warehouse ID'),
  shipToAddressId: z.string().uuid('Invalid address ID').optional(),
  shipToAddress: z.string().max(500).optional(),
  carrierCode: z.string().max(50).optional(),
  carrierName: z.string().max(100).optional(),
  trackingNumber: z.string().max(100).optional(),
  shipDate: z.string().datetime().optional(),
  expectedArrivalDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(asnItemSchema).min(1, 'At least one item is required'),
});

/**
 * Update ASN
 * PUT /api/dispatch/asn/:id
 */
export const updateASNSchema = z.object({
  shipToAddress: z.string().max(500).optional().nullable(),
  carrierCode: z.string().max(50).optional().nullable(),
  carrierName: z.string().max(100).optional().nullable(),
  trackingNumber: z.string().max(100).optional().nullable(),
  shipDate: z.string().datetime().optional().nullable(),
  expectedArrivalDate: z.string().datetime().optional().nullable(),
  actualArrivalDate: z.string().datetime().optional().nullable(),
  status: ASNStatusEnum.optional(),
  remarks: z.string().max(500).optional().nullable(),
  items: z.array(asnItemSchema).optional(),
});

/**
 * ASN Query Params
 * GET /api/dispatch/asn
 */
export const asnQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  deliveryNoteId: z.string().uuid().optional(),
  status: ASNStatusEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

/**
 * ASN Action (Approve/Reject/Reschedule)
 * POST /api/dispatch/asn/:id/approve, reject, reschedule
 */
export const asnActionSchema = z.object({
  remarks: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
  newExpectedArrivalDate: z.string().datetime().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>;
export type UpdateDeliveryNoteInput = z.infer<typeof updateDeliveryNoteSchema>;
export type DeliveryNoteQueryInput = z.infer<typeof deliveryNoteQuerySchema>;
export type DeliveryNoteActionInput = z.infer<typeof deliveryNoteActionSchema>;

export type CreateASNInput = z.infer<typeof createASNSchema>;
export type UpdateASNInput = z.infer<typeof updateASNSchema>;
export type ASNQueryInput = z.infer<typeof asnQuerySchema>;
export type ASNActionInput = z.infer<typeof asnActionSchema>;
