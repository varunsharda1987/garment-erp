/**
 * Purchase Order Validation Schemas
 *
 * Zod schemas for purchase order endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { UnitEnum, flexMaterialId, formNumberRequired } from './common.schema';
import { ThreadPackagingTypeEnum, ThreadPlyEnum } from './generated/prisma-enums';
import { isQtyZero } from '../utils/quantity';

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
  'SHORT_CLOSED',
  'CANCELLED',
  'PENDING_GREIGE',
  'READY_FOR_PROCESSING',
]);

export const POSourceEnum = z.enum(['MANUAL', 'COST_SHEET', 'MRP', 'SERVICE_REQUIREMENT', 'PRODUCTION_RUN']);

// Phase 5a: intentional MATERIAL-ONLY subset of the Prisma POCategory enum — purchase
// orders can no longer be created for service/processing work (that is a Job Work Order).
// Query filters elsewhere still accept the full Prisma enum for reading legacy rows.
export const ManualPOCategoryEnum = z.enum([
  'FABRIC',
  'GREIGE',
  'TRIMS',
  'THREAD',
  'LACE',
  'GREIGE_LACE',
  'GENERAL',
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
  materialId: flexMaterialId('material ID').optional(),
  serviceType: z.string().max(50).optional(),
  serviceDescription: z.string().max(500).optional(),
  orderedQuantity: z.number().positive('Quantity must be positive'),
  unit: UnitEnum,
  unitPrice: z.number().positive('Unit price must be greater than 0'),
  remarks: z.string().max(500).nullish(),
  foldLengthCm: z.number().positive().max(999.99).nullish(), // "L" - fold length in cm
  // The weaver this line is bought from, when known at ordering (Phase 1b) — the GRN line records the
  // one that actually came. Never stored on the greige master.
  weaverId: z.string().uuid('Invalid weaver').nullish(),
  // A thread line's pack (2026-09-26): thread is ordered as cones (2- or 3-ply) or tubes (3-ply) in BOXES. The
  // server checks the pair and sets the box size from thread_packaging_specs; other lines ignore both.
  threadPackagingType: ThreadPackagingTypeEnum.nullish(),
  threadPly: ThreadPlyEnum.nullish(),
  // Split delivery (2026-09-26): how much of this line goes to each place. Omit on every line for one
  // place / "to be advised". The places of one line add up to its quantity (checked on the items array).
  deliveries: z
    .array(
      z.object({
        warehouseId: z.string().uuid('Invalid delivery place'),
        quantity: formNumberRequired(z.number().positive('Each place needs a quantity above 0')),
      })
    )
    .max(10, 'At most 10 delivery places')
    .nullish(),
});

/** Each line's delivery places add up to what it orders, within the one quantity tolerance. */
const deliveriesAddUp = (
  items: Array<{ orderedQuantity: number; deliveries?: Array<{ quantity: number }> | null }>,
  ctx: z.RefinementCtx
) => {
  items.forEach((item, index) => {
    if (!item.deliveries?.length) return;
    const placed = item.deliveries.reduce((sum, d) => sum + d.quantity, 0);
    if (!isQtyZero(placed - item.orderedQuantity)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, 'deliveries'],
        message: `Delivery places add up to ${Math.round(placed * 1000) / 1000}, but the line orders ${item.orderedQuantity}`,
      });
    }
  });
};

/**
 * PO Item for update
 */
export const updatePurchaseOrderItemSchema = z.object({
  orderedQuantity: z.number().positive('Quantity must be positive').optional(),
  unit: UnitEnum.optional(),
  unitPrice: z.number().positive('Unit price must be greater than 0').optional(),
  remarks: z.string().max(500).nullish(),
  threadPackagingType: ThreadPackagingTypeEnum.nullish(),
  threadPly: ThreadPlyEnum.nullish(),
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
  poCategory: ManualPOCategoryEnum.optional(),
  items: z.array(purchaseOrderItemSchema).min(1, 'At least one item required').superRefine(deliveriesAddUp),
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
  // Items carry their OWN id on update so the server can update the line in place instead of
  // rebuilding it. Rebuilding mints a new uuid, and every link table pointing at PO items is
  // onDelete: Cascade — so a rebuild silently strands the material requirement behind the line.
  items: z
    .array(purchaseOrderItemSchema.extend({ id: z.string().uuid().optional() }))
    .min(1)
    .superRefine(deliveriesAddUp)
    .optional(),
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
 * Short-close PO
 * PATCH /api/purchase-orders/:id/short-close
 *
 * The supplier delivered less than ordered and the balance is not being chased. Distinct from
 * cancel (which claims nothing was delivered) and from RECEIVED (which claims it all arrived).
 * reorderBalance defaults to FALSE — short-closing means the demand ends here unless the buyer
 * explicitly says the balance is still needed.
 */
export const shortClosePurchaseOrderSchema = z.object({
  reason: z.string().min(1, 'A reason for closing short is required').max(500),
  reorderBalance: z.boolean().default(false),
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
  orderId: z.string().uuid().optional(), // Filter POs linked to a specific order
  serviceWorkOrderId: z.string().uuid().optional(), // Scope service-PO dropdowns to a work order
  // 'TO_BE_ADVISED' = no delivery place decided yet (the PO list's "Delivery: to be advised" filter)
  delivery: z.enum(['TO_BE_ADVISED']).optional(),
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
export type ShortClosePurchaseOrderInput = z.infer<typeof shortClosePurchaseOrderSchema>;
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
  // Required by the server once the PO has been sent (every change is a revision with a reason)
  reason: z.string().trim().max(500).nullish(),
});

export type AmendDeliveryLocationInput = z.infer<typeof amendDeliveryLocationSchema>;

/**
 * Change delivery — one place, a split across places, or "to be advised" (2026-09-26)
 * PUT /api/purchase-orders/:id/delivery-plan
 * The reason is required by the server once the PO has been sent. Balance and receipt rules are
 * enforced by helpers/po-delivery-plan.helper.ts.
 */
const deliveryReason = z.string().trim().max(500).nullish();
export const amendDeliveryPlanSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('TO_BE_ADVISED'), reason: deliveryReason }),
  z.object({
    mode: z.literal('ONE_PLACE'),
    warehouseId: z.string().uuid('Pick the delivery place'),
    reason: deliveryReason,
  }),
  z.object({
    mode: z.literal('SPLIT'),
    points: z
      .array(
        z.object({
          warehouseId: z.string().uuid('Pick the delivery place'),
          lines: z.array(
            z.object({
              poItemId: z.string().uuid(),
              quantity: formNumberRequired(z.number().nonnegative('A quantity cannot be negative')),
            })
          ),
        })
      )
      .min(2, 'A split needs at least two places')
      .max(10, 'At most 10 delivery places'),
    reason: deliveryReason,
  }),
]);

export type AmendDeliveryPlanInput = z.infer<typeof amendDeliveryPlanSchema>;
