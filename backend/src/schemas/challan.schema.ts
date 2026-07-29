import { z } from 'zod';

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
 * Quick Issue Challan Schema
 * POST /api/challans/quick-issue
 * The controller spreads req.body (plus a server-derived issuedById) straight into quickIssueChallan,
 * which creates the challan AND deducts stock — same payload shape as create, so it reuses createChallanSchema.
 */
export const quickIssueChallanSchema = createChallanSchema;

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
 * Greige Outward Challan Schema
 * POST /api/challans/greige-outward
 *
 * Mirrors CreateGreigeOutwardChallanInput in challan.service.ts minus `userId`, which the controller
 * derives from the authenticated user (req.user.userId) and must NOT be accepted from the body.
 * IDs are validated as non-empty strings (not .uuid()) because the service only does findUnique
 * lookups with them — an unknown id yields a clean "not found", while a non-string reached Prisma.
 */
export const createGreigeOutwardChallanSchema = z.object({
  materialRequirementId: z.string().min(1, 'Material requirement ID is required').trim(),
  fabricProcessingId: z.string().min(1, 'Fabric processing ID is required').trim(),
  orderId: z.string().min(1).trim().optional(),
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

// Type exports for use in controllers
export type CreateChallanInput = z.infer<typeof createChallanSchema>;
export type QuickIssueChallanInput = z.infer<typeof quickIssueChallanSchema>;
export type ReceiveChallanInput = z.infer<typeof receiveChallanSchema>;
export type CreateGreigeOutwardChallanInput = z.infer<typeof createGreigeOutwardChallanSchema>;
export type SplitProductionRunInput = z.infer<typeof splitProductionRunSchema>;
