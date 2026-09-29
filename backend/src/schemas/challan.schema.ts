import { z } from 'zod';
import { formNumber, formNumberRequired } from './common.schema';

/**
 * Challan Type Enum - matches Prisma ChallanType
 */
export const ChallanTypeEnum = z.enum(['OUTWARD', 'INWARD', 'INTERNAL']);

// Date pickers send 'YYYY-MM-DD' (z.string().datetime() would reject it, and a plain string reaches
// Prisma's DateTime columns and 500s). z.coerce.date() parses the date-only string; the preprocess maps
// '' (a cleared date input) → undefined so an optional date is dropped instead of becoming Invalid Date.
const optionalChallanDate = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date().optional());

/**
 * Challan Item Schema
 */
const challanItemSchema = z.object({
  itemType: z.string().min(1, 'Item type is required'),
  materialId: z.string().optional(),
  fabricId: z.string().optional(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must not exceed 500 characters')
    .trim(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().optional(),
  colorId: z.string().optional(),
  sizeId: z.string().optional(),
  rate: z.number().nonnegative('Rate must be 0 or greater').optional(),
  remarks: z.string().max(500, 'Remarks must not exceed 500 characters').trim().optional(),
  greigeStockId: z.string().optional(),
  fabricStockId: z.string().optional(),
  laceStockId: z.string().optional(),
  threadStockId: z.string().optional(),
  materialRequirementId: z.string().optional(),
  serviceRequirementId: z.string().optional(),
  // Measurement + traceability fields the service persists (challan.service.ts) — without these the
  // Zod validator strips them and the columns land NULL.
  foldLengthCm: z.number().nonnegative('Fold length must be 0 or greater').optional(),
  thanCount: z
    .number()
    .int('Than count must be a whole number')
    .nonnegative('Than count must be 0 or greater')
    .optional(),
  componentName: z.string().max(200, 'Component name must not exceed 200 characters').trim().optional(),
  colorName: z.string().max(200, 'Color name must not exceed 200 characters').trim().optional(),
});

/**
 * Create Challan Schema
 * POST /api/challans
 */
export const createChallanSchema = z.object({
  challanType: ChallanTypeEnum,
  challanDate: optionalChallanDate,
  orderId: z.string().optional(),
  productionRunId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  fabricProcessingId: z.string().optional(),
  fromType: z.string().min(1, 'From type is required'),
  fromId: z.string().optional(),
  fromName: z.string().min(1, 'From name is required').max(200, 'From name must not exceed 200 characters').trim(),
  toType: z.string().min(1, 'To type is required'),
  toId: z.string().optional(),
  toName: z.string().min(1, 'To name is required').max(200, 'To name must not exceed 200 characters').trim(),
  vehicleNumber: z.string().max(20, 'Vehicle number must not exceed 20 characters').trim().optional(),
  driverName: z.string().max(100, 'Driver name must not exceed 100 characters').trim().optional(),
  driverPhone: z.string().max(20, 'Driver phone must not exceed 20 characters').trim().optional(),
  lrNumber: z.string().max(50, 'LR number must not exceed 50 characters').trim().optional(),
  expectedDate: optionalChallanDate,
  unit: z.string().optional(),
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').trim().optional(),
  items: z.array(challanItemSchema).min(1, 'At least one item is required'),
});

/**
 * Issue Challan Schema
 * PUT /api/challans/:id/issue — no body, or `{ takeHeld: true }` after the user confirmed taking goods held for
 * other orders (po-allocation D10).
 */
export const issueChallanSchema = z.object({
  takeHeld: z.boolean().optional(),
});

/**
 * Quick Issue Challan Schema
 * POST /api/challans/quick-issue
 * The controller passes req.body (plus a server-derived issuedById) to quickIssueChallan, which creates the
 * challan AND deducts stock — the create payload, plus takeHeld as for the issue.
 */
export const quickIssueChallanSchema = createChallanSchema.extend({
  /** The user confirmed taking goods held for other orders (po-allocation D10) — refused with 409 otherwise */
  takeHeld: z.boolean().optional(),
});

/**
 * Receive Challan Item Schema — one received line.
 */
const receiveChallanItemSchema = z.object({
  challanItemId: z.string().min(1, 'Challan item id is required'),
  receivedQty: z.number().nonnegative('Received quantity must be 0 or greater'),
  damagedQty: z.number().nonnegative('Damaged quantity must be 0 or greater').optional(),
  remarks: z.string().max(500, 'Remarks must not exceed 500 characters').trim().optional(),
});

/**
 * Receive Challan Schema
 * PUT /api/challans/:id/receive
 * receivedById is derived from the authenticated user in the controller, so it is NOT part of the body.
 */
export const receiveChallanSchema = z.object({
  receivedDate: optionalChallanDate,
  items: z.array(receiveChallanItemSchema).min(1, 'At least one received item is required'),
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').trim().optional(),
});

/**
 * Split Production Run Schema
 * POST /api/production-runs/:id/split (route lives in challan.routes.ts)
 *
 * Mirrors SplitInput[] in production-run-split.service.ts. `quantity` must be a whole number because
 * the service sums the splits and compares them to work_orders.totalQuantity (Int) before writing
 * each child's totalQuantity — a float or a numeric string could never match and 500'd in Prisma.
 * The service itself rejects <2 splits, so min(2) only converts an existing failure into a clean 400.
 */
const splitEntrySchema = z.object({
  quantity: z.coerce.number().int('Split quantity must be a whole number').positive('Split quantity must be positive'),
  fabricLotInfo: z.record(z.string(), z.unknown()).optional().nullable(),
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').trim().optional(),
});

export const splitProductionRunSchema = z.object({
  splits: z.array(splitEntrySchema).min(2, 'At least 2 splits are required'),
});

/**
 * Goods-in-transit challan (2026-09-29) — POST /api/challans/goods-in-transit
 * Our Rule 45 challan for goods a supplier despatches straight to a processor, issued before they arrive.
 * Mirrors TransitChallanInput in helpers/direct-supply-challan.helper.ts (the one writer). Quantities are
 * COUNTED (the supplier's paper); pieces are the than / bale / roll list as despatched.
 */
const transitPieceSchema = z.object({
  detailType: z.enum(['THAN', 'ROLL']),
  baleNumber: formNumber(z.number().int().positive()),
  sequenceNo: z.number().int().nonnegative(), // allow-strict-number — typed dialog payload, never blank
  meters: formNumberRequired(z.number().positive('Every than / roll needs its metres')),
  baleNo: z.string().max(30).trim().optional().nullable(),
  thanNo: z.string().max(30).trim().optional().nullable(),
});

const transitLineSchema = z.object({
  poItemId: z.string().uuid('Invalid PO line'),
  quantity: formNumberRequired(z.number().positive('Enter the quantity despatched')),
  foldLengthCm: formNumber(z.number().positive().max(999.99, 'Fold length is in cm and must be under 1000')),
  entryMode: z.enum(['TOTAL_METERS', 'THAN_WISE', 'BALE_WISE', 'ROLL_WISE']).optional().nullable(),
  pieces: z.array(transitPieceSchema).max(2000).optional(),
});

export const createTransitChallanSchema = z.object({
  poId: z.string().uuid('Invalid purchase order'),
  poDeliveryPointId: z.string().uuid('Invalid delivery point').optional().nullable(),
  challanDate: optionalChallanDate,
  dispatchedOn: z.coerce.date({ message: 'Enter the day the supplier despatched the goods' }),
  invoiceNumber: z.string().max(100).trim().optional().nullable(),
  invoiceDate: optionalChallanDate,
  vehicleNumber: z.string().max(20).trim().optional().nullable(),
  lrNumber: z.string().max(50).trim().optional().nullable(),
  ewayBillNumber: z.string().max(20).trim().optional().nullable(),
  ewayBillDate: optionalChallanDate,
  remarks: z.string().max(500).trim().optional().nullable(),
  lines: z.array(transitLineSchema).min(1, 'Add at least one line'),
});

/** GET /api/challans/goods-in-transit?poId= */
export const transitChallanQuerySchema = z.object({
  poId: z.string().uuid('Invalid purchase order'),
});

/** PATCH /api/challans/:id/cancel-transit — the truck never came, or the goods went elsewhere */
export const cancelTransitChallanSchema = z.object({
  reason: z.string().trim().min(3, 'Say why the challan is cancelled').max(500),
});

// Type exports for use in controllers
export type CreateTransitChallanBody = z.infer<typeof createTransitChallanSchema>;
export type CreateChallanInput = z.infer<typeof createChallanSchema>;
export type QuickIssueChallanInput = z.infer<typeof quickIssueChallanSchema>;
export type IssueChallanBody = z.infer<typeof issueChallanSchema>;
export type ReceiveChallanInput = z.infer<typeof receiveChallanSchema>;
export type SplitProductionRunInput = z.infer<typeof splitProductionRunSchema>;
