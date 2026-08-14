/**
 * Order Validation Schemas
 *
 * Zod schemas for order management endpoints.
 */

import { z } from 'zod';

// Order status enum - matches Prisma OrderStatus
export const OrderStatus = z.enum(['PENDING', 'IN_PRODUCTION', 'COMPLETED', 'DISPATCHED', 'CANCELLED']);

// Size/colour breakdown line (colorId may be an empty string for size-only orders — backend nulls it)
const orderItemBreakupSchema = z.object({
  colorId: z.string(),
  sizeId: z.string(),
  quantity: z.number().int().nonnegative('Quantity cannot be negative'),
});

// Order item schema — matches the frontend CreateOrderItem and the service OrderItemInput. The service
// reads `breakup` (size/colour breakdown) and `totalQuantity`, NOT a flat `quantity`; those were absent
// so validateBody stripped them and every order dropped its size/colour breakup (bug-hunt F5).
const orderItemSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  itemDescription: z.string().max(500).optional(),
  unitPrice: z.number().nonnegative('Unit price cannot be negative').or(z.string()),
  totalQuantity: z.number().int().nonnegative().optional(),
  deliveryDate: z.string().optional(),
  remarks: z.string().max(500).optional(),
  breakup: z.array(orderItemBreakupSchema).default([]),
  // Legacy fields — kept optional for back-compat; the service uses breakup/totalQuantity.
  variantId: z.string().uuid('Invalid variant ID').optional(),
  discount: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
});

// Create order schema.
// expectedDeliveryDate is REQUIRED: the controller does new Date(expectedDeliveryDate) into a required
// DB column, so omitting it produced an Invalid Date → 500 instead of a 400 (bug-hunt orders-18).
// The previously-accepted orderNumber/status/currencyId/exchangeRate/billingAddress/internalNotes fields
// were removed: the controller never read them, so they were silently dropped (bug-hunt orders-18).
export const createOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  orderDate: z.coerce.date().optional(),
  expectedDeliveryDate: z.coerce.date(), // Required; renamed from deliveryDate to match frontend
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  totalQuantity: z.number().int().nonnegative().optional(), // Direct total when items have no size breakup
  paymentTerms: z.string().max(100).optional(), // Changed from paymentTermsId (UUID) to string
  shippingAddress: z.string().max(500).optional(),
  remarks: z.string().max(2000).optional(), // Renamed from notes to match frontend
  items: z.array(orderItemSchema).min(1, 'At least one item is required'), // Renamed from lineItems
});

// Update order schema. NO body `id`: the order id arrives as the :id route param (validated there) and
// the frontend never sends it in the body — requiring it here made PUT /orders/:id 400 on every call
// (bug-hunt orders-1).
export const updateOrderSchema = createOrderSchema.partial();

// Update order status schema (same: id comes from the route param, not the body).
export const updateOrderStatusSchema = z.object({
  status: OrderStatus,
  reason: z.string().max(500).optional(),
});

// Cancel order with options.
// POST /orders/:id/cancel — the controller reads ONLY `laceHandling` and `cancellationReason`, and
// defaults BOTH ('RELEASE_TO_STOCK' / 'Order cancelled'), so both are optional here.
// laceHandling mirrors LaceHandlingOption in order.service.ts (there is no Prisma enum for it).
// The body is normalised from undefined/null to {}: under Express 5 / body-parser 2 a POST sent with
// no body at all leaves req.body === undefined, and this endpoint is legitimately callable that way —
// a bare z.object() would 400 a request that works today.
export const cancelOrderSchema = z.preprocess(
  (body) => (body === undefined || body === null ? {} : body),
  z.object({
    laceHandling: z.enum(['RELEASE_TO_STOCK', 'RETURN_TO_SUPPLIER']).optional(),
    cancellationReason: z.string().max(500).optional(),
  })
);

// Order query params schema
export const orderQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  status: OrderStatus.optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  // fromDate/toDate are what the controller and frontend actually use; the schema previously validated
  // startDate/endDate that nobody sends, letting raw fromDate/toDate bypass validation (bug-hunt orders-12)
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'orderNumber', 'orderDate', 'expectedDeliveryDate', 'status', 'totalQuantity'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;

/**
 * MRP-49: create missing production work orders for an order.
 * POST /api/orders/:orderId/work-orders
 *
 * All optional — sensible defaults are derived from the order itself (plannedEndDate falls back
 * to the order's expectedDeliveryDate rather than an invented "+30 days").
 */
export const createWorkOrdersForOrderSchema = z.object({
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});
