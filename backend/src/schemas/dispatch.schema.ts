/**
 * Dispatch Module Validation Schemas
 *
 * Zod schemas for delivery-notes and ASN endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { DeliveryConfirmationEnum } from './generated/prisma-enums';

// Helper for validating IDs that can be UUID or CUID (color_master uses CUID)
const isValidIdFormat = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val);

// Date fields use z.coerce.date() (NOT z.string().datetime()): the UI date pickers send YYYY-MM-DD,
// which .datetime() rejects — that made recording POD (and other dispatch writes) 400 on every call
// (bug-hunt dispatch-6). Nullable dates need the union: a bare z.coerce.date() turns null into 1970-01-01.
const nullableDate = z.union([z.null(), z.coerce.date()]);

// ============================================================================
// Enums
// ============================================================================

// Matches Prisma DeliveryStatus enum
export const DeliveryNoteStatusEnum = z.enum(['PENDING', 'IN_TRANSIT', 'DELIVERED']);

// Matches Prisma ASNStatus enum (note: RESCHEDULE not RESCHEDULED)
export const ASNStatusEnum = z.enum(['PENDING', 'APPLIED', 'APPROVED', 'REJECTED', 'RESCHEDULE']);

// ============================================================================
// DELIVERY NOTE SCHEMAS
// ============================================================================

/**
 * Delivery Note Item
 */
const deliveryNoteItemSchema = z.object({
  orderId: z.string().uuid('Invalid order ID').optional(),
  orderItemId: z.string().uuid('Invalid order item ID').optional(),
  // styleId/colorId/sizeId are REQUIRED: delivery_note_items has all three as non-nullable columns,
  // so an item missing any of them rolled back the whole create with an opaque Prisma 500 instead of
  // a field-level 400 (bug-hunt dispatch-7).
  styleId: z.string().uuid('Invalid style ID'),
  variantId: z.string().uuid('Invalid variant ID').optional(),
  skuId: z.string().uuid('Invalid SKU ID').optional(),
  // The controller writes colorId/sizeId onto delivery_note_items; without them here validateBody
  // stripped them and the insert failed (bug-hunt F5 — delivery-note creation 500'd).
  colorId: z.string().refine(isValidIdFormat, { message: 'Invalid color ID' }),
  sizeId: z.string().uuid('Invalid size ID'),
  quantity: z.number().int('Quantity must be a whole number').positive('Quantity must be positive'), // BUG-DIS5 fix: enforce integer
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
    deliveryDate: z.coerce.date().optional(), // Renamed from dispatchDate to match controller
    expectedDeliveryDate: z.coerce.date().optional(),
    deliveryAddress: z.string().max(500).optional(),
    remarks: z.string().max(500).optional(),
    items: z.array(deliveryNoteItemSchema).min(1, 'At least one item is required'),
    // Packed cartons covered by this note — linked as dispatch_cartons rows so dispatching the note
    // can flip them to DISPATCHED (bug-hunt dispatch-9).
    cartonIds: z.array(z.string().uuid('Invalid carton ID')).optional(),
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
    deliveryDate: nullableDate.optional(), // Renamed from dispatchDate
    expectedDeliveryDate: nullableDate.optional(),
    actualDeliveryDate: nullableDate.optional(),
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
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
  })
  .passthrough();

/**
 * Delivery Note Action (Confirm/Dispatch/Deliver/Cancel)
 * POST /api/dispatch/delivery-notes/:id/confirm, dispatch, deliver, cancel
 */
export const deliveryNoteActionSchema = z
  .object({
    remarks: z.string().max(500).optional(),
    actualDeliveryDate: z.coerce.date().optional(),
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
  quantity: z.number().int('Quantity must be a whole number').positive('Quantity must be positive').optional(), // BUG-DIS5 fix: enforce integer
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
  // The controller reads sku.plannedQty (not `quantity`); mismatched name meant it was stripped and
  // ASN creation threw (bug-hunt F5).
  plannedQty: z.number().int().nonnegative().optional(),
});

/**
 * Create ASN
 * POST /api/dispatch/asn
 * Supports both simple dispatch application and EDI-style ASN
 */
export const createASNSchema = z
  .object({
    // Controller fields (simple dispatch application). orderId/plannedDispatchQty/cartonsPlanned/
    // requestedShipDate are REQUIRED: asn_applications has them as non-nullable columns and the
    // controller does new Date(requestedShipDate) unconditionally — optional here meant an omission
    // became an Invalid-Date/Prisma 500 instead of a 400 (bug-hunt dispatch-7).
    orderId: z.string().uuid('Invalid order ID'),
    plannedDispatchQty: z.number().int().nonnegative(),
    cartonsPlanned: z.number().int().nonnegative(),
    requestedShipDate: z.coerce.date(),
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
    shipDate: z.coerce.date().optional(),
    expectedArrivalDate: z.coerce.date().optional(),
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
    shipDate: nullableDate.optional(),
    expectedArrivalDate: nullableDate.optional(),
    actualArrivalDate: nullableDate.optional(),
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
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
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
    newExpectedArrivalDate: z.coerce.date().optional(),
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
    lrDate: z.coerce.date().optional(),
    freightCharges: z.number().nonnegative().optional(),
    freightPaidBy: z.string().max(50).optional(),
    expectedDeliveryDate: z.coerce.date().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Record Proof of Delivery
 * POST /api/dispatch/delivery-notes/:id/record-pod
 */
export const recordPODSchema = z
  .object({
    // deliveryDate/receivedBy/deliveryStatus are REQUIRED: dispatch_pods has all three non-nullable
    // and the controller does new Date(deliveryDate) unconditionally — optional here turned an
    // omission into an Invalid-Date/Prisma 500 instead of a 400 (bug-hunt dispatch-7).
    deliveryDate: z.coerce.date(),
    deliveryTime: z.string().max(10).optional(),
    receivedBy: z.string().min(1, 'Receiver name is required').max(100),
    designation: z.string().max(100).optional(),
    customerSignOff: z.boolean().optional(),
    podDocumentUrl: z.string().max(500).optional(),
    // Use DeliveryConfirmationEnum from Prisma (not DeliveryStatus - this is for POD confirmation)
    deliveryStatus: DeliveryConfirmationEnum,
    shortageQty: z.number().int().nonnegative().optional(),
    rejectionReason: z.string().max(500).optional(),
    customerGrnNumber: z.string().max(50).optional(),
    customerGrnDate: z.coerce.date().optional(),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Approve ASN
 * POST /api/dispatch/asn/:id/approve
 */
export const approveASNSchema = z
  .object({
    // Required: the controller does new Date(appointmentDate) unconditionally (bug-hunt dispatch-7).
    // NOTE: the /asn/:id/apply route must NOT use this schema — apply sends no body (dispatch-14).
    appointmentDate: z.coerce.date(),
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
    rescheduleDate: z.coerce.date(),
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
