/**
 * Order BOM Validation Schemas
 *
 * Zod schemas for order-bom endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { flexMaterialId } from './common.schema';
import {
  MaterialTypeEnum as PrismaMaterialTypeEnum,
  OrderBOMStatusEnum as PrismaOrderBOMStatusEnum,
  MaterialUsageCategoryEnum,
} from './generated/prisma-enums';

// ============================================================================
// Enums (imported from generated prisma-enums to ensure alignment)
// ============================================================================

// Import directly from prisma-enums to prevent drift (bug-hunt orders-14)
export const MaterialTypeEnum = PrismaMaterialTypeEnum;

// Prisma MaterialUsageCategory: GARMENT_TRIM, VALUE_ADDITION, PACKAGING
// Extended with FABRIC for application needs (not written to this column)
export const UsageCategoryEnum = z.enum(['GARMENT_TRIM', 'PACKAGING', 'VALUE_ADDITION', 'FABRIC']);

// Prisma OrderBOMStatus: DRAFT, APPROVED, LOCKED (no CANCELLED)
export const OrderBOMStatusEnum = PrismaOrderBOMStatusEnum;

// ============================================================================
// BOM Item Schema
// ============================================================================

/**
 * Generic-trim master FKs on order_bom_items.
 *
 * These 16 are the trim types with no dedicated column pair elsewhere in this schema (button,
 * thread, zipper, lace, elastic, label, packaging each have their own field above). They were
 * missing here until 2026-08-31, and because PUT /orders/:orderId/bom rebuilds every row from
 * the validated body, Zod stripped them and the rebuild wrote them back NULL — an interlining
 * line with no FK is dropped from MRP entirely. Keep this list in step with the same-named
 * columns in prisma schema.prisma order_bom_items; order-bom.service.ts imports it so the
 * schema and every rebuild mapping cannot drift apart again.
 */
export const GENERIC_TRIM_FK_FIELDS = [
  'hookEyeId',
  'snapButtonId',
  'buckleId',
  'beltId',
  'velcroId',
  'drawstringId',
  'ribbonId',
  'sequinId',
  'beadId',
  'motifId',
  'interliningId',
  'paddingId',
  'otherFastenerId',
  'otherTapeId',
  'otherDecorativeId',
  'otherFunctionalId',
] as const;

export type GenericTrimFkField = (typeof GENERIC_TRIM_FK_FIELDS)[number];

/** CAD provenance columns carried on a fabric/greige BOM line. */
export const CAD_PROVENANCE_FIELDS = ['selectedCadId', 'fabricWidthInches', 'cadAverageSnapshot'] as const;

const genericTrimFkShape = Object.fromEntries(
  GENERIC_TRIM_FK_FIELDS.map((field) => [field, z.string().uuid().optional().nullable()])
) as Record<GenericTrimFkField, z.ZodNullable<z.ZodOptional<z.ZodString>>>;

export const orderBOMItemSchema = z.object({
  // BUG-ORD12: Added optional id field for identifying existing items during updates
  id: z.string().uuid().optional(),
  materialType: MaterialTypeEnum,
  ...genericTrimFkShape,
  // CAD provenance — fabricWidthInches drives MRP's width-filtered stock netting, so losing it
  // silently nets rolls of any width and under-raises the fabric PO.
  selectedCadId: z.string().uuid().optional().nullable(),
  fabricWidthInches: z.number().optional().nullable(),
  cadAverageSnapshot: z.number().optional().nullable(),
  materialId: flexMaterialId('material ID').optional(),
  buttonId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  zipperId: z.string().uuid().optional(),
  laceId: z.string().uuid().optional(),
  elasticId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  packagingId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  greigeId: z.string().uuid().optional(),
  // Greige LACE source (FK to lace_master). Distinct from greigeId, which FKs greige_master
  // (fabric) — a lace id written into greigeId is a guaranteed FK violation.
  greigeLaceId: z.string().uuid().optional().nullable(),
  sourcingStrategy: z.string().optional(),
  processorId: z.string().uuid().optional(),
  greigeCost: z.number().optional(),
  processingCost: z.number().optional(),
  rateCardId: z.string().uuid().optional(),
  colorName: z.string().optional(),
  quantityPerGarment: z.number().nonnegative('Quantity must be non-negative'),
  orderQuantity: z.number().int().positive('Order quantity must be positive'),
  wastagePercent: z.number().min(0).max(100).optional(),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  componentName: z.string().optional(),
  usageCategory: UsageCategoryEnum.optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

// ============================================================================
// Create Schemas
// ============================================================================

/**
 * Create Order BOM from Cost Sheet
 * POST /api/orders/:orderId/bom
 */
export const createFromCostSheetSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  costSheetId: z.string().min(1, 'Cost sheet ID is required'), // CS-TIMESTAMP format
  orderItemId: z.string().uuid().optional(),
  // Qty-rate audit 2026-08-24: creation blocks with RATE_SLAB_CHANGED when the order quantity
  // lands in a different processor rate slab than the style was costed at; re-send with true
  // to accept the order-quantity rates (written to THIS order's BOM only).
  acceptRateChanges: z.boolean().optional(),
});

/**
 * Copy Order BOM from Previous Order
 * POST /api/orders/:orderId/bom/copy/:sourceOrderId
 */
export const copyFromPreviousOrderSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  orderItemId: z.string().uuid().optional(),
  adjustQuantity: z.number().int().positive().optional(),
  // Same RATE_SLAB_CHANGED contract as createFromCostSheetSchema — copied BOMs carry the
  // source order's historical rates and must be re-checked at the target quantity.
  acceptRateChanges: z.boolean().optional(),
});

/**
 * Update Order BOM Items
 * PUT /api/orders/:orderId/bom
 */
export const updateOrderBOMSchema = z.object({
  items: z.array(orderBOMItemSchema).min(1, 'At least one BOM item is required'),
});

/**
 * Approve and Calculate MRP
 * POST /api/orders/:orderId/bom/approve-and-calculate
 */
export const approveAndCalculateMRPSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  calculateMRP: z.boolean().optional().default(true),
  calculateServices: z.boolean().optional().default(true),
  requiredDate: z.string().or(z.date()).optional(),
});

/**
 * Calculate MRP Standalone
 * POST /api/orders/:orderId/bom/calculate-mrp
 */
export const calculateMRPStandaloneSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  requiredDate: z.string().or(z.date()).optional(),
});

/**
 * Fabric Width Change
 * POST /api/order-bom/:id/change-width
 */
export const changeWidthSchema = z.object({
  fabricItemChanges: z
    .array(
      z.object({
        bomItemId: z.string().uuid('Invalid BOM item ID'),
        newCadId: z.string().uuid('Invalid CAD ID'),
      })
    )
    .min(1, 'At least one fabric item change is required'),
});

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * Order BOM Query Params
 * GET /api/order-bom
 */
export const orderBOMQuerySchema = z.object({
  orderId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  status: OrderBOMStatusEnum.optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type OrderBOMItemInput = z.infer<typeof orderBOMItemSchema>;
export type CreateFromCostSheetInput = z.infer<typeof createFromCostSheetSchema>;
export type CopyFromPreviousOrderInput = z.infer<typeof copyFromPreviousOrderSchema>;
export type UpdateOrderBOMInput = z.infer<typeof updateOrderBOMSchema>;
export type ApproveAndCalculateMRPInput = z.infer<typeof approveAndCalculateMRPSchema>;
export type CalculateMRPStandaloneInput = z.infer<typeof calculateMRPStandaloneSchema>;
export type ChangeWidthInput = z.infer<typeof changeWidthSchema>;
export type OrderBOMQueryInput = z.infer<typeof orderBOMQuerySchema>;
