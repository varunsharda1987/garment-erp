/**
 * Purchase Order Validation Schemas
 *
 * Zod schemas for purchase order endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { UnitEnum } from './common.schema';

// ============================================================================
// Enums (match Prisma enums)
// ============================================================================

// Shared full Prisma-aligned Unit enum (includes PAIR/PACK/GRAM/LITER/ROLL).
export { UnitEnum };

export const PurchaseOrderStatusEnum = z.enum([
  'DRAFT',
  'SENT',
  'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
  'PENDING_GREIGE',
  'READY_FOR_PROCESSING',
]);

export const POSourceEnum = z.enum(['MANUAL', 'COST_SHEET', 'MRP', 'SERVICE_REQUIREMENT', 'PRODUCTION_RUN']);

export const POCategoryEnum = z.enum([
  'FABRIC',
  'GREIGE',
  'PROCESSING',
  'TRIMS',
  'THREAD',
  'LACE',
  'GREIGE_LACE',
  'LACE_PROCESSING',
  'GENERAL',
  'EMBROIDERY_SERVICE',
  'WASHING_SERVICE',
  'FINISHING_SERVICE',
  'CUTTING_SERVICE',
  'STITCHING_SERVICE',
  'HANDWORK_SERVICE',
  'SMOCKING_SERVICE',
  'TRANSPORTATION_SERVICE',
  'BUTTON',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'PACKAGING',
  'MACHINE_PART',
  'OTHER_MATERIAL',
]);

export const DeliveryLocationTypeEnum = z.enum(['WAREHOUSE', 'PROCESSOR']);

// ============================================================================
// Purchase Order Item Schemas
// ============================================================================

/**
 * PO Item for creation
 */
export const purchaseOrderItemSchema = z.object({
  materialId: z.string().uuid('Invalid material ID').optional(),
  serviceType: z.string().max(50).optional(),
  serviceDescription: z.string().max(500).optional(),
  orderedQuantity: z.number().positive('Quantity must be positive'),
  unit: UnitEnum,
  unitPrice: z.number().positive('Unit price must be greater than 0'),
  remarks: z.string().max(500).nullish(),
  foldLengthCm: z.number().positive().max(999.99).nullish(), // "L" - fold length in cm
});

/**
 * PO Item for update
 */
export const updatePurchaseOrderItemSchema = z.object({
  orderedQuantity: z.number().positive('Quantity must be positive').optional(),
  unit: UnitEnum.optional(),
  unitPrice: z.number().positive('Unit price must be greater than 0').optional(),
  remarks: z.string().max(500).nullish(),
});

// ============================================================================
// Purchase Order Schemas
// ============================================================================

/**
 * Create Purchase Order
 * POST /api/purchase-orders
 */
export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  expectedDeliveryDate: z.string().or(z.date()),
  paymentTerms: z.string().max(100).nullish(),
  remarks: z.string().max(1000).nullish(),
  poCategory: POCategoryEnum.optional(),
  items: z.array(purchaseOrderItemSchema).min(1, 'At least one item required'),
  // Optional traceability links (for Manual POs)
  styleId: z.string().uuid('Invalid style ID').nullish(),
  orderId: z.string().uuid('Invalid order ID').nullish(),
  cadId: z.string().uuid('Invalid CAD ID').nullish(),
  // Delivery location (warehouse ID - type is derived from warehouse)
  deliveryLocationId: z.string().uuid('Invalid delivery location ID').nullish(),
});

/**
 * Update Purchase Order
 * PUT /api/purchase-orders/:id
 */
export const updatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  expectedDeliveryDate: z.string().or(z.date()).optional(),
  paymentTerms: z.string().max(100).nullish(),
  remarks: z.string().max(1000).nullish(),
  items: z.array(purchaseOrderItemSchema).min(1).optional(),
  // Optional traceability links (for Manual POs)
  styleId: z.string().uuid('Invalid style ID').nullish(),
  orderId: z.string().uuid('Invalid order ID').nullish(),
  cadId: z.string().uuid('Invalid CAD ID').nullish(),
  // Delivery location (warehouse ID - type is derived from warehouse)
  deliveryLocationId: z.string().uuid('Invalid delivery location ID').nullish(),
});

/**
 * Add Item to PO
 * POST /api/purchase-orders/:id/items
 */
export const addPurchaseOrderItemSchema = purchaseOrderItemSchema;

/**
 * Cancel PO
 * PATCH /api/purchase-orders/:id/cancel
 */
export const cancelPurchaseOrderSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

/**
 * Acknowledge PO (optional fields)
 * PATCH /api/purchase-orders/:id/acknowledge
 */
export const acknowledgePurchaseOrderSchema = z
  .object({
    remarks: z.string().max(500).optional(),
  })
  .optional();

/**
 * Send PO (optional fields)
 * PATCH /api/purchase-orders/:id/send
 */
export const sendPurchaseOrderSchema = z
  .object({
    remarks: z.string().max(500).optional(),
  })
  .optional();

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * Purchase Order Query Params
 * GET /api/purchase-orders
 */
export const purchaseOrderQuerySchema = z.object({
  status: PurchaseOrderStatusEnum.optional(),
  source: POSourceEnum.optional(),
  poCategories: z.string().optional(), // Comma-separated list
  supplierId: z.string().uuid().optional(),
  serviceWorkOrderId: z.string().uuid().optional(), // Scope service-PO dropdowns to a work order
  search: z.string().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>;
export type UpdatePurchaseOrderItemInput = z.infer<typeof updatePurchaseOrderItemSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;
export type PurchaseOrderQueryInput = z.infer<typeof purchaseOrderQuerySchema>;

// ============================================================================
// Amendment Schemas
// ============================================================================

/**
 * Amend Delivery Location
 * PATCH /api/purchase-orders/:id/delivery-location
 * Now simplified - only needs warehouse ID (all locations are warehouses)
 */
export const amendDeliveryLocationSchema = z.object({
  deliveryLocationId: z.string().uuid('Invalid delivery location ID'),
});

export type AmendDeliveryLocationInput = z.infer<typeof amendDeliveryLocationSchema>;
