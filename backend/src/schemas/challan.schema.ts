import { z } from 'zod';

/**
 * Challan Type Enum - matches Prisma ChallanType
 */
export const ChallanTypeEnum = z.enum(['OUTWARD', 'INWARD', 'INTERNAL']);

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
  materialRequirementId: z.string().optional(),
  serviceRequirementId: z.string().optional(),
});

/**
 * Create Challan Schema
 * POST /api/challans
 */
export const createChallanSchema = z.object({
  challanType: ChallanTypeEnum,
  challanDate: z.string().optional(),
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
  expectedDate: z.string().optional(),
  unit: z.string().optional(),
  remarks: z.string().max(1000, 'Remarks must not exceed 1000 characters').trim().optional(),
  items: z.array(challanItemSchema).min(1, 'At least one item is required'),
});

// Type exports for use in controllers
export type CreateChallanInput = z.infer<typeof createChallanSchema>;
