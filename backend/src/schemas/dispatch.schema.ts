/**
 * Dispatch Module Validation Schemas
 *
 * Zod schemas for delivery-notes and ASN endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// Helper for validating IDs that can be UUID or CUID (color_master uses CUID)
const isValidIdFormat = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val);

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
export const createDeliveryNoteSchema = z
  .object({
    orderId: z.string().uuid('Invalid order ID').optional(),
    customerId: z.string().uuid('Invalid customer ID'),
    warehouseId: z.string().uuid('Invalid warehouse ID').optional(), // Made optional - not used by controller currently
    transporterId: z.string().uuid('Invalid transporter ID').optional(),
    vehicleNumber: z.string().max(50).optional(),
    driverName: z.string().max(100).optional(),
    driverContact: z.string().max(20).optional(),
    deliveryDate: z.string().datetime().optional(), // Renamed from dispatchDate to match controller
    expectedDeliveryDate: z.string().datetime().optional(),
    deliveryAddress: z.string().max(500).optional(),
    remarks: z.string().max(500).optional(),
    items: z.array(deliveryNoteItemSchema).min(1, 'At least one item is required'),
  })
  .passthrough();

/**
 * Update Delivery Note
 * PUT /api/dispatch/delivery-notes/:id
 */
export const updateDeliveryNoteSchema = z
  .object({
    transporterId: z.string().uuid('Invalid transporter ID').optional().nullable(),
    vehicleNumber: z.string().max(50).optional().nullable(),
    driverName: z.string().max(100).optional().nullable(),
    driverContact: z.string().max(20).optional().nullable(),
    deliveryDate: z.string().datetime().optional().nullable(), // Renamed from dispatchDate
    expectedDeliveryDate: z.string().datetime().optional().nullable(),
    actualDeliveryDate: z.string().datetime().optional().nullable(),
    deliveryAddress: z.string().max(500).optional().nullable(),
    status: DeliveryNoteStatusEnum.optional(),
    remarks: z.string().max(500).optional().nullable(),
    items: z.array(deliveryNoteItemSchema).optional(),
  })
  .passthrough();

/**
 * Delivery Note Query Params
 * GET /api/dispatch/delivery-notes
 */
export const deliveryNoteQuerySchema = z
  .object({
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
  })
  .passthrough();

/**
 * Delivery Note Action (Confirm/Dispatch/Deliver/Cancel)
 * POST /api/dispatch/delivery-notes/:id/confirm, dispatch, deliver, cancel
 */
export const deliveryNoteActionSchema = z
  .object({
    remarks: z.string().max(500).optional(),
    actualDeliveryDate: z.string().datetime().optional(),
    receivedBy: z.string().max(100).optional(),
    proofOfDelivery: z.string().max(500).optional(),
  })
  .passthrough();

// ============================================================================
// ASN (ADVANCE SHIPPING NOTICE) SCHEMAS
// ============================================================================

/**
 * ASN Item (EDI-style)
 */
const asnItemSchema = z.object({
  deliveryNoteItemId: z.string().uuid('Invalid delivery note item ID').optional(),
  styleId: z.string().uuid('Invalid style ID').optional(),
  variantId: z.string().uuid('Invalid variant ID').optional(),
  skuId: z.string().uuid('Invalid SKU ID').optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  cartonCount: z.number().int().nonnegative().optional(),
  ssccCode: z.string().max(50).optional(), // EDI: Serial Shipping Container Code
  remarks: z.string().max(500).optional(),
});

/**
 * ASN SKU (simple dispatch application)
 */
const asnSkuSchema = z.object({
  colorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }).optional(),
  sizeId: z.string().uuid('Invalid size ID').optional(),
  quantity: z.number().int().nonnegative().optional(),
});

/**
 * Create ASN
 * POST /api/dispatch/asn
 * Supports both simple dispatch application and EDI-style ASN
 */
export const createASNSchema = z
  .object({
    // Controller fields (simple dispatch application)
    orderId: z.string().uuid('Invalid order ID').optional(),
    plannedDispatchQty: z.number().int().nonnegative().optional(),
    cartonsPlanned: z.number().int().nonnegative().optional(),
    requestedShipDate: z.string().datetime().optional(),
    skus: z.array(asnSkuSchema).optional(), // Simple SKU breakdown

    // EDI fields (optional for future EDI integration)
    deliveryNoteId: z.string().uuid('Invalid delivery note ID').optional(),
    customerId: z.string().uuid('Invalid customer ID').optional(), // Made optional
    shipFromWarehouseId: z.string().uuid('Invalid warehouse ID').optional(), // Made optional
    shipToAddressId: z.string().uuid('Invalid address ID').optional(),
    shipToAddress: z.string().max(500).optional(),
    carrierCode: z.string().max(50).optional(),
    carrierName: z.string().max(100).optional(),
    trackingNumber: z.string().max(100).optional(),
    shipDate: z.string().datetime().optional(),
    expectedArrivalDate: z.string().datetime().optional(),
    remarks: z.string().max(500).optional(),
    items: z.array(asnItemSchema).optional(), // EDI-style items (made optional)
  })
  .passthrough();

/**
 * Update ASN
 * PUT /api/dispatch/asn/:id
 */
export const updateASNSchema = z
  .object({
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
  })
  .passthrough();

/**
 * ASN Query Params
 * GET /api/dispatch/asn
 */
export const asnQuerySchema = z
  .object({
    page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
    limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
    search: z.string().max(100).optional(),
    orderId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    deliveryNoteId: z.string().uuid().optional(),
    status: ASNStatusEnum.optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
  })
  .passthrough();

/**
 * ASN Action (Approve/Reject/Reschedule)
 * POST /api/dispatch/asn/:id/approve, reject, reschedule
 */
export const asnActionSchema = z
  .object({
    remarks: z.string().max(500).optional(),
    rejectionReason: z.string().max(500).optional(),
    newExpectedArrivalDate: z.string().datetime().optional(),
  })
  .passthrough();

// ============================================================================
// DEDICATED WORKFLOW SCHEMAS
// ============================================================================

/**
 * Assign Transport to Delivery Note
 * POST /api/dispatch/delivery-notes/:id/assign-transport
 */
export const assignTransportSchema = z
  .object({
    transporterName: z.string().max(100).optional(),
    transporterGstin: z.string().max(15).optional(),
    vehicleNumber: z.string().max(50).optional(),
    vehicleType: z.string().max(50).optional(),
    driverName: z.string().max(100).optional(),
    driverPhone: z.string().max(20).optional(),
    driverLicense: z.string().max(50).optional(),
    lrNumber: z.string().max(50).optional(),
    lrDate: z.string().datetime().optional(),
    freightCharges: z.number().nonnegative().optional(),
    freightPaidBy: z.string().max(50).optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Record Proof of Delivery
 * POST /api/dispatch/delivery-notes/:id/record-pod
 */
export const recordPODSchema = z
  .object({
    deliveryDate: z.string().datetime().optional(),
    deliveryTime: z.string().max(10).optional(),
    receivedBy: z.string().max(100).optional(),
    designation: z.string().max(100).optional(),
    customerSignOff: z.boolean().optional(),
    podDocumentUrl: z.string().max(500).optional(),
    deliveryStatus: z.enum(['DELIVERED', 'PARTIAL', 'REJECTED']).optional(),
    shortageQty: z.number().int().nonnegative().optional(),
    rejectionReason: z.string().max(500).optional(),
    customerGrnNumber: z.string().max(50).optional(),
    customerGrnDate: z.string().datetime().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Approve ASN
 * POST /api/dispatch/asn/:id/approve
 */
export const approveASNSchema = z
  .object({
    appointmentDate: z.string().datetime().optional(),
    appointmentTime: z.string().max(10).optional(),
    buyerRefNumber: z.string().max(50).optional(),
    approvedQty: z.number().int().nonnegative().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Reject ASN
 * POST /api/dispatch/asn/:id/reject
 */
export const rejectASNSchema = z
  .object({
    rejectionReason: z.string().max(500),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Reschedule ASN
 * POST /api/dispatch/asn/:id/reschedule
 */
export const rescheduleASNSchema = z
  .object({
    rescheduleDate: z.string().datetime(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

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

// Dedicated workflow types
export type AssignTransportInput = z.infer<typeof assignTransportSchema>;
export type RecordPODInput = z.infer<typeof recordPODSchema>;
export type ApproveASNInput = z.infer<typeof approveASNSchema>;
export type RejectASNInput = z.infer<typeof rejectASNSchema>;
export type RescheduleASNInput = z.infer<typeof rescheduleASNSchema>;
