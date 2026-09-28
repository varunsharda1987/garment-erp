/**
 * Purchase Order Validation Schemas
 *
 * Zod schemas for purchase order endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { POCategory } from '@prisma/client';
import { UnitEnum, flexMaterialId, formNumber, formNumberRequired } from './common.schema';
import { POCategoryEnum, ThreadPackagingTypeEnum, ThreadPlyEnum } from './generated/prisma-enums';
import { isQtyZero } from '../utils/quantity';
import { CREATABLE_PO_CATEGORIES, PO_SORT_FIELDS, isPoDateAfterToday } from '../types/purchaseOrder.types';
import { materialHsnCodeSchema } from './material.schema';

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
// The list itself is CREATABLE_PO_CATEGORIES (types/purchaseOrder.types.ts), shared with unified PO creation.
export const ManualPOCategoryEnum = z.enum(CREATABLE_PO_CATEGORIES as [POCategory, ...POCategory[]]);

/**
 * The PO's own date (owner decision 2026-09-27): settable on the form, today by default, a past date
 * allowed, never a future one (IST calendar days). Blank / null = not sent — create stamps now, update
 * leaves it. A bare z.coerce.date() would turn null into 01-Jan-1970, hence the preprocess.
 */
const poDateSchema = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce
    .date()
    .refine((d) => !isPoDateAfterToday(d), 'The PO date cannot be after today')
    .optional()
);

/**
 * Expected delivery (2026-09-28): a real date, not any string — `z.string().or(z.date())` let junk through
 * to a 400 "Invalid data provided to database". Blank / null = not sent (a bare coerce turns null into
 * 01-Jan-1970). "Not before the PO date" needs both dates, so the service checks it (422
 * PO_DELIVERY_BEFORE_PO_DATE) — on edit against the stored PO date when only one is sent.
 */
const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const expectedDeliveryDateSchema = z.preprocess(
  blankToUndefined,
  z.coerce.date({ error: 'Pick the expected delivery date' })
);

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
  // Kept to paise (the column is 2 dp) — a rate under half a paisa would be saved as ₹0.00
  unitPrice: z.number().min(0.005, 'Unit price must be at least ₹0.01'),
  // The line's GST % as typed (0 is a rate); absent / blank = the material's. The HSN it is billed
  // under; absent / blank = the material's own. The form's GST box was never sent (2026-09-28).
  gstRate: formNumber(z.number().min(0, 'GST cannot be negative').max(28, 'GST cannot be above 28%')),
  hsnCode: materialHsnCodeSchema,
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
  unitPrice: z.number().min(0.005, 'Unit price must be at least ₹0.01').optional(),
  remarks: z.string().max(500).nullish(),
  threadPackagingType: ThreadPackagingTypeEnum.nullish(),
  threadPly: ThreadPlyEnum.nullish(),
  // Absent = the line keeps the rate / HSN it was saved with; null = back to the material's
  gstRate: formNumber(z.number().min(0, 'GST cannot be negative').max(28, 'GST cannot be above 28%')),
  hsnCode: materialHsnCodeSchema,
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
  expectedDeliveryDate: expectedDeliveryDateSchema,
  poDate: poDateSchema,
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
  expectedDeliveryDate: z.preprocess(blankToUndefined, z.coerce.date().optional()),
  poDate: poDateSchema,
  paymentTerms: z.string().max(100).nullish(),
  // null or '' clears the remarks; absent leaves them
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
  reason: z.string().trim().min(1, 'Cancellation reason is required').max(500),
  // ADMIN only (403 otherwise): cancel a PO that has already received goods. Without it such a PO is
  // refused with PO_GOODS_RECEIVED — Close Short is the normal exit (owner decision 2026-09-27).
  force: z.boolean().optional(),
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
// poCategories, sortBy and the dates used to be any string: a bad value reached Prisma and came back
// as 400 "Invalid data provided to database". Each is now checked here and named in the 400.
export const purchaseOrderQuerySchema = z.object({
  status: PurchaseOrderStatusEnum.optional(),
  source: POSourceEnum.optional(),
  // Comma-separated POCategory values → an array (the full Prisma enum: legacy rows stay readable)
  poCategories: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    )
    .pipe(z.array(POCategoryEnum))
    .optional(),
  supplierId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(), // Filter POs linked to a specific order
  serviceWorkOrderId: z.string().uuid().optional(), // Scope service-PO dropdowns to a work order
  // 'TO_BE_ADVISED' = no delivery place decided yet (the PO list's "Delivery: to be advised" filter)
  delivery: z.enum(['TO_BE_ADVISED']).optional(),
  search: z.string().max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  sortBy: z.enum(PO_SORT_FIELDS).optional(),
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
