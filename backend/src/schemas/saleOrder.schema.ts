/**
 * Sale Order Validation Schemas
 *
 * Zod schemas for sale order CRUD and stock allocation.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { PriorityEnum } from './generated/prisma-enums';

// ============================================================================
// Enums
// ============================================================================

export const SaleOrderStatusEnum = z.enum([
  'DRAFT',
  'CONFIRMED',
  // Allocation states the DB assigns and the UI filters by (were missing -> 400 on those filters).
  'PARTIALLY_ALLOCATED',
  'FULLY_ALLOCATED',
  'PARTIALLY_DISPATCHED',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
]);

/** Columns the list may be ordered by — anything else would reach Prisma's `orderBy` raw. */
export const SaleOrderSortFieldEnum = z.enum([
  'createdAt',
  'saleDate',
  'saleOrderNumber',
  'totalAmount',
  'status',
  'expectedShipDate',
]);

// ============================================================================
// SALE ORDER SCHEMAS
// ============================================================================

/**
 * Sale Order Item
 */
const saleOrderItemSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  colorId: z.string().uuid('Invalid color ID').nullable().optional(),
  sizeId: z.string().uuid('Invalid size ID').nullable().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  remarks: z.string().max(500).optional(),
  // The buyer's own style code for this line. OMIT it and the style's current code is captured;
  // SEND it (including the value read back from this order) and it is kept exactly — which is how
  // re-saving an order preserves the code its lines were originally taken under.
  buyerStyleRef: z.string().max(100).nullable().optional(),
});

/**
 * Create Sale Order
 * POST /api/sale-orders
 */
export const createSaleOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  buyerPoNumber: z.string().max(100).optional(), // Buyer's (HOK) PO number — B2B tracking key
  styleId: z.string().uuid('Invalid style ID').optional().nullable(), // Primary style for the order
  // Bare 'YYYY-MM-DD' (the frontend's <input type="date">) and full ISO must both pass —
  // the controller does new Date(expectedShipDate) either way.
  expectedShipDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional(),
  buyerDeadline: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional(), // Buyer's required completion date
  // z.coerce.date(): date pickers send YYYY-MM-DD, z.string().datetime() rejects it
  orderDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional(),
  paymentTerms: z.string().max(100).optional(),
  deliveryAddress: z.string().max(500).optional(),
  remarks: z.string().max(500).optional(),
  // BUG-ORD2 fix: items made optional - frontend creates order first, adds items on detail page
  items: z.array(saleOrderItemSchema).optional().default([]),
});

/**
 * Update Sale Order
 * PUT /api/sale-orders/:id
 */
export const updateSaleOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID').optional(),
  buyerPoNumber: z.string().max(100).optional().nullable(), // Buyer's (HOK) PO number — B2B tracking key
  styleId: z.string().uuid('Invalid style ID').optional().nullable(), // Primary style for the order
  // .nullable(): the ERP edit sheet sends null for an empty date input. Without it every edit of
  // an order with no ship date 400'd ("Invalid request data") — the sibling dates were already
  // nullable, this one was not.
  expectedShipDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional()
    .nullable(),
  buyerDeadline: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional()
    .nullable(), // Buyer's required completion date
  // z.coerce.date(): date pickers send YYYY-MM-DD, z.string().datetime() rejects it
  orderDate: z.coerce.date().optional().nullable(),
  deliveryDate: z.coerce.date().optional().nullable(),
  paymentTerms: z.string().max(100).optional().nullable(),
  deliveryAddress: z.string().max(500).optional().nullable(),
  // Landmine №2: no `status` here — the service never applied it (silent drop), and status
  // is event-written (confirm/cancel/POD) or derived (sale-order-status.helper), never PUT.
  remarks: z.string().max(500).optional().nullable(),
  items: z.array(saleOrderItemSchema).optional(),
});

/**
 * Confirm Sale Order
 * POST /api/sale-orders/:id/confirm
 */
export const confirmSaleOrderSchema = z.object({
  remarks: z.string().max(500).optional(),
});

/**
 * Start Production (make-to-order: create the linked production order for the full SO quantity)
 * POST /api/sale-orders/:id/start-production
 */
/** POST /api/sale-orders/:id/link-production-order — the existing production order to link */
export const linkProductionOrderSchema = z.object({
  orderId: z.string().uuid('Invalid production order ID'),
});

export const startProductionSchema = z.object({
  // Optional override; falls back to buyerDeadline ?? expectedShipDate ?? deliveryDate server-side
  expectedDeliveryDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional(),
  priority: PriorityEnum.optional(),
  remarks: z.string().max(500).optional(),
  // What to produce. SHORTFALL (default) = each line's quantity minus what finished-goods stock
  // already covers (allocatedQty + dispatchedQty); FULL = the whole sale-order quantity, as before
  // 2026-09-17 (order-system T1-A: a half-allocated order used to be produced twice over).
  quantityMode: z.enum(['SHORTFALL', 'FULL']).optional(),
  // Per-line override — the complete list: a line left out is not produced. Wins over quantityMode.
  items: z
    .array(
      z.object({
        saleOrderItemId: z.string().uuid('Invalid sale order item ID'),
        quantity: z.number().int().nonnegative(),
      })
    )
    .min(1)
    .optional(),
});

/**
 * Allocate Stock
 * POST /api/sale-orders/allocate-stock
 */
export const allocateStockSchema = z.object({
  saleOrderItemId: z.string().uuid('Invalid sale order item ID'),
  fgStockId: z.string().uuid('Invalid FG stock ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  remarks: z.string().max(500).optional(),
});

/**
 * Deallocate Stock
 * POST /api/sale-orders/deallocate-stock
 * P7.2: Release a specific FG stock allocation
 */
export const deallocateStockSchema = z.object({
  allocationId: z.string().uuid('Invalid allocation ID'),
  remarks: z.string().max(500).optional(),
});

/**
 * Sale Order Query Params
 * GET /api/sale-orders
 */
export const saleOrderQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  customerId: z.string().uuid().optional(),
  status: SaleOrderStatusEnum.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  // Whitelisted: sortBy lands in a Prisma `orderBy` key, so an arbitrary string reaches the
  // database and comes back as an opaque "Invalid data provided to database" 400.
  sortBy: SaleOrderSortFieldEnum.optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Add Buyer PO
 * POST /api/sale-orders/:id/buyer-pos
 */
export const addBuyerPoSchema = z.object({
  buyerPoNumber: z.string().min(1, 'Buyer PO number is required').max(100),
  remarks: z.string().max(500).optional(),
  // The customer raises one PO per delivery location; this is the location it ships to, chosen
  // from that customer's own address book. OPTIONAL on purpose — the field is new, and a PO must
  // never be unrecordable because its location has not been added to the customer yet.
  deliveryAddressId: z.string().uuid('Invalid delivery location').optional().nullable(),
  // Bare 'YYYY-MM-DD' from <input type="date"> and full ISO must both pass, same as
  // expectedShipDate above. NEVER z.string().datetime() — it rejects the date-only form.
  poDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional()
    .nullable(),
});

/**
 * Update a Buyer PO's details — location / date / remarks, without touching the document.
 * PATCH /api/sale-orders/buyer-pos/:poId
 *
 * buyerPoNumber is deliberately NOT editable here: it is the key of
 * @@unique([saleOrderId, buyerPoNumber]) and the value `syncPrimaryBuyerPo` mirrors into the
 * legacy `sale_orders.buyerPoNumber` scalar that the B2B app reads. Renaming a PO means removing
 * it and adding the new one.
 */
export const updateBuyerPoSchema = z.object({
  deliveryAddressId: z.string().uuid('Invalid delivery location').optional().nullable(),
  poDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional()
    .nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Upload a Buyer PO document — MULTIPART (multipart/form-data)
 * POST /api/sale-orders/buyer-pos/:poId/document
 *
 * ⚠ This body is parsed by multer (`uploadBuyerPoDocument`, .single('file')), so validateBody MUST
 * be mounted AFTER it. The FILE ITSELF lives on `req.file` and is never part of req.body.
 *
 * There are no text fields — location and date are edited via PATCH — but the schema still exists
 * and is mounted for two reasons: scripts/hooks/check-route-validation.js fails any POST without a
 * validateBody, and the preprocess makes a file-only upload (where multer leaves req.body empty)
 * pass rather than 400.
 */
export const uploadBuyerPoDocumentSchema = z.preprocess(
  (body) => (body === undefined || body === null ? {} : body),
  z.object({}).passthrough()
);

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSaleOrderInput = z.infer<typeof createSaleOrderSchema>;
export type UpdateSaleOrderInput = z.infer<typeof updateSaleOrderSchema>;
export type ConfirmSaleOrderInput = z.infer<typeof confirmSaleOrderSchema>;
export type StartProductionInput = z.infer<typeof startProductionSchema>;
export type AllocateStockInput = z.infer<typeof allocateStockSchema>;
export type SaleOrderQueryInput = z.infer<typeof saleOrderQuerySchema>;
export type AddBuyerPoInput = z.infer<typeof addBuyerPoSchema>;
export type UpdateBuyerPoInput = z.infer<typeof updateBuyerPoSchema>;
