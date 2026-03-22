import { z } from 'zod';

/**
 * Priority Enum - matches Prisma Priority
 */
export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

/**
 * Order Status Enum - matches Prisma OrderStatus
 */
export const OrderStatusEnum = z.enum([
  'PENDING',
  'IN_PRODUCTION',
  'COMPLETED',
  'DISPATCHED',
  'CANCELLED',
  'SPLIT',
]);

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
export const createWorkOrderSchema = z.object({
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
  remarks: z
    .string()
    .max(1000, 'Remarks must not exceed 1000 characters')
    .trim()
    .optional()
    .nullable(),
  colorSizeBreakup: z
    .array(colorSizeBreakupItemSchema)
    .min(1, 'At least one color-size breakup entry is required'),
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
  completedQuantity: z.number().int().nonnegative('Completed quantity must be 0 or greater').optional(),
  status: OrderStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  remarks: z
    .string()
    .max(1000, 'Remarks must not exceed 1000 characters')
    .trim()
    .optional()
    .nullable(),
  approvedById: z.string().optional(),
});

// Type exports for use in controllers
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
