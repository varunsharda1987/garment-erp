/**
 * Stock Management Validation Schemas
 *
 * Zod schemas for inventory/stock management endpoints.
 */

import { z } from 'zod';
import { MovementTypeEnum, CountTypeEnum, CountStatusEnum, MaterialTypeEnum } from './generated/prisma-enums';

// Movement type enum - imported from Prisma enums
export const MovementType = MovementTypeEnum;

// Stock count type enum - imported from Prisma enums
export const CountType = CountTypeEnum;

// Stock count status enum - imported from Prisma enums
export const CountStatus = CountStatusEnum;

// Stock movement schema
export const createStockMovementSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  targetWarehouseId: z.string().uuid('Invalid target warehouse ID').optional(),
  materialId: z.string().uuid('Invalid material ID'),
  // Use MaterialTypeEnum from Prisma to ensure alignment with database
  materialType: MaterialTypeEnum,
  movementType: MovementType,
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1).max(20),
  referenceNumber: z.string().max(50).optional(),
  referenceType: z.string().max(50).optional(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  movementDate: z.coerce.date().default(() => new Date()),
});

// Stock adjustment schema
export const stockAdjustmentSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  materialId: z.string().uuid('Invalid material ID'),
  // Use MaterialTypeEnum from Prisma to ensure alignment with database
  materialType: MaterialTypeEnum,
  adjustmentQuantity: z.number().refine((val) => val !== 0, {
    message: 'Adjustment quantity cannot be zero',
  }),
  reason: z.enum(['Damage', 'Loss', 'Correction', 'Found', 'Other']),
  notes: z.string().max(1000).optional(),
});

// Stock transfer schema
export const stockTransferSchema = z.object({
  sourceWarehouseId: z.string().uuid('Invalid source warehouse ID'),
  targetWarehouseId: z.string().uuid('Invalid target warehouse ID'),
  materialId: z.string().uuid('Invalid material ID'),
  // Use MaterialTypeEnum from Prisma to ensure alignment with database
  materialType: MaterialTypeEnum,
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().max(1000).optional(),
});

// Stock count schema
export const createStockCountSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  countDate: z.coerce.date(),
  countType: CountType,
  notes: z.string().max(1000).optional(),
  items: z.array(
    z.object({
      materialId: z.string().uuid('Invalid material ID'),
      materialType: MaterialTypeEnum,
      systemQuantity: z.number().nonnegative(),
      countedQuantity: z.number().nonnegative(),
      variance: z.number().optional(),
      notes: z.string().max(500).optional(),
    })
  ),
});

// Update stock count schema
export const updateStockCountSchema = z.object({
  id: z.string().uuid(),
  status: CountStatus.optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        materialId: z.string().uuid('Invalid material ID'),
        countedQuantity: z.number().nonnegative(),
        notes: z.string().max(500).optional(),
      })
    )
    .optional(),
});

// Stock query params schema
export const stockQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
  materialType: z.string().optional(),
  belowMinStock: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Movement query params schema
export const movementQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
  movementType: MovementType.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type StockTransferInput = z.infer<typeof stockTransferSchema>;
export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;
export type UpdateStockCountInput = z.infer<typeof updateStockCountSchema>;
export type StockQueryInput = z.infer<typeof stockQuerySchema>;
export type MovementQueryInput = z.infer<typeof movementQuerySchema>;
