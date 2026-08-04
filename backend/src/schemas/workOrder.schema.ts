import { z } from 'zod';
import { flexMaterialId } from './common.schema';

/**
 * Priority Enum - matches Prisma Priority
 */
export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

/**
 * Order Status Enum - matches Prisma OrderStatus
 */
export const OrderStatusEnum = z.enum(['PENDING', 'IN_PRODUCTION', 'COMPLETED', 'DISPATCHED', 'CANCELLED', 'SPLIT']);

/**
 * Color-Size Breakup Item Schema
 */
const colorSizeBreakupItemSchema = z.object({
  colorId: z.string().nullable(),
  sizeId: z.string().min(1, 'Size ID is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

/**
 * Create Work Order Schema
 * POST /api/work-orders
 */
export const createWorkOrderSchema = z
  .object({
    orderId: z.string().optional().nullable(),
    orderItemId: z.string().optional().nullable(),
    stockProductionOrderId: z.string().optional().nullable(),
    stockProductionOrderItemId: z.string().optional().nullable(),
    styleId: z.string().min(1, 'Style ID is required'),
    warehouseId: z.string().optional().nullable(),
    plannedStartDate: z.string().min(1, 'Planned start date is required'),
    plannedEndDate: z.string().min(1, 'Planned end date is required'),
    totalQuantity: z.number().int().positive('Total quantity must be a positive integer'),
    priority: PriorityEnum.optional(),
    remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').trim().optional().nullable(),
    colorSizeBreakup: z.array(colorSizeBreakupItemSchema).min(1, 'At least one color-size breakup entry is required'),
  })
  // Header total must equal the size-grid sum — everything downstream (cutting ratios, WIP orderQty,
  // split guards) trusts totalQuantity as authoritative (bug-hunt production-19).
  .refine((data) => data.colorSizeBreakup.reduce((sum, b) => sum + b.quantity, 0) === data.totalQuantity, {
    message: 'Sum of color-size breakup quantities must equal totalQuantity',
    path: ['totalQuantity'],
  });

/**
 * Update Work Order Schema
 * PUT /api/work-orders/:id
 */
export const updateWorkOrderSchema = z.object({
  warehouseId: z.string().optional(),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  actualStartDate: z.string().optional().nullable(),
  actualEndDate: z.string().optional().nullable(),
  totalQuantity: z.number().int().positive('Total quantity must be a positive integer').optional(),
  // completedQuantity is intentionally NOT accepted: it is DERIVED (SUM of PACKING production_tracking
  // entries, recomputed in addProductionTracking's transaction). Hand-setting it corrupted CMT costing
  // (totalCost = perPiece × completedQuantity) — bug-hunt production-1.
  status: OrderStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').trim().optional().nullable(),
  approvedById: z.string().optional(),
});

/**
 * Production Stage Enum - matches Prisma ProductionStage
 */
export const ProductionStageEnum = z.enum([
  'CUTTING',
  'STITCHING',
  'FINISHING',
  'CHECKING',
  'PACKING',
  'ORDER_RECEIVED',
  'PENDING_COSTING',
  'PENDING_GREIGE_ORDER',
  'TRIMS_NOT_ORDERED',
  'IN_PRINTING',
  'IN_DYING',
  'IN_EMBROIDERY',
  'IN_HANDWORK',
  'IN_CUTTING',
  'IN_STITCHING',
  'IN_FINISHING',
  'IN_SMOCKING',
  'READY_TO_SHIP',
  'SHIPPED',
  'COMPLETED',
]);

// ============================================================================
// Mutation sub-route schemas (bug-hunt production-16: these POST routes had no
// validateBody, so NaN quantities / invalid enums reached Prisma as 500s)
// ============================================================================

/**
 * Add Production Tracking
 * POST /api/work-orders/:id/tracking
 */
export const addProductionTrackingSchema = z.object({
  productionStage: ProductionStageEnum,
  quantityCompleted: z.number().int().nonnegative('Quantity completed must be zero or positive'),
  remarks: z.string().max(1000).optional().nullable(),
  adminOverride: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
});

/**
 * Split Work Order
 * POST /api/work-orders/:id/split
 */
export const splitWorkOrderSchema = z.object({
  plannedDispatchDate: z.coerce.date(),
  breakupToSplit: z
    .array(
      z.object({
        colorId: z.string().nullable(),
        sizeId: z.string().min(1, 'Size ID is required'),
        quantity: z.number().int().nonnegative(), // zero rows are skipped by the service
      })
    )
    .min(1, 'At least one breakup entry is required'),
  remarks: z.string().max(1000).optional().nullable(),
});

/**
 * Push to Cutting
 * POST /api/work-orders/:id/push-to-cutting
 */
export const pushToCuttingSchema = z.object({
  adminOverride: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
});

/**
 * Issue Fabric
 * POST /api/work-orders/:id/issue-fabric
 */
export const issueFabricSchema = z.object({
  lots: z
    .array(
      z.object({
        fabricStockId: z.string().uuid('Invalid fabric stock ID'),
        fabricId: z.string().uuid('Invalid fabric ID'),
        quantity: z.number().positive('Quantity must be positive'),
        description: z.string().max(500).optional().default(''),
      })
    )
    .min(1, 'At least one fabric lot must be selected'),
  remarks: z.string().max(1000).optional(),
});

/**
 * Issue Trims / Packaging (material items)
 * POST /api/work-orders/:id/issue-trims and /:id/issue-packaging
 */
export const issueMaterialItemsSchema = z.object({
  items: z
    .array(
      z.object({
        materialId: flexMaterialId('material ID'),
        quantity: z.number().positive('Quantity must be positive'),
        unit: z.string().min(1, 'Unit is required').max(20),
        description: z.string().max(500).optional().default(''),
      })
    )
    .min(1, 'At least one item must be selected'),
  remarks: z.string().max(1000).optional(),
});

/**
 * Issue Thread
 * POST /api/work-orders/:id/issue-thread
 */
export const issueThreadSchema = z.object({
  items: z
    .array(
      z.object({
        threadStockId: z.string().uuid('Invalid thread stock ID'),
        quantity: z.number().positive('Quantity must be positive'),
        unit: z.string().min(1, 'Unit is required').max(20),
        description: z.string().max(500).optional().default(''),
      })
    )
    .min(1, 'At least one thread lot must be selected'),
  remarks: z.string().max(1000).optional(),
});

// Type exports for use in controllers
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
export type AddProductionTrackingInput = z.infer<typeof addProductionTrackingSchema>;
export type SplitWorkOrderInput = z.infer<typeof splitWorkOrderSchema>;
export type PushToCuttingInput = z.infer<typeof pushToCuttingSchema>;
export type IssueFabricInput = z.infer<typeof issueFabricSchema>;
export type IssueMaterialItemsInput = z.infer<typeof issueMaterialItemsSchema>;
export type IssueThreadInput = z.infer<typeof issueThreadSchema>;
