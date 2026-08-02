import { z } from 'zod';

/**
 * Warehouse Type Enum - matches Prisma WarehouseType
 */
export const WarehouseTypeEnum = z.enum([
  'RAW_MATERIAL',
  'FINISHED_GOODS',
  'WORK_IN_PROGRESS',
  'GENERAL',
  'TRANSIT',
  'JOB_WORK',
]);

/**
 * Create Warehouse Schema
 * POST /api/warehouses
 */
export const createWarehouseSchema = z.object({
  warehouseCode: z
    .string()
    .min(1, 'Warehouse code is required')
    .max(20, 'Warehouse code must not exceed 20 characters')
    .trim(),
  warehouseName: z
    .string()
    .min(1, 'Warehouse name is required')
    .max(200, 'Warehouse name must not exceed 200 characters')
    .trim(),
  warehouseType: WarehouseTypeEnum,
  address: z.string().max(500, 'Address must not exceed 500 characters').trim().optional().nullable(),
  city: z.string().max(100, 'City must not exceed 100 characters').trim().optional().nullable(),
  state: z.string().max(100, 'State must not exceed 100 characters').trim().optional().nullable(),
  country: z.string().max(100, 'Country must not exceed 100 characters').trim().optional().nullable(),
  pincode: z.string().max(10, 'Pincode must not exceed 10 characters').trim().optional().nullable(),
  contactPerson: z.string().max(200, 'Contact person must not exceed 200 characters').trim().optional().nullable(),
  contactPhone: z.string().max(20, 'Contact phone must not exceed 20 characters').trim().optional().nullable(),
  contactEmail: z.string().email('Invalid email format').max(200).trim().optional().nullable(),
  capacity: z.number().nonnegative('Capacity must be 0 or greater').optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  isVirtual: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Warehouse Schema
 * PUT /api/warehouses/:id
 */
export const updateWarehouseSchema = z.object({
  warehouseName: z
    .string()
    .min(1, 'Warehouse name is required')
    .max(200, 'Warehouse name must not exceed 200 characters')
    .trim()
    .optional(),
  warehouseType: WarehouseTypeEnum.optional(),
  address: z.string().max(500, 'Address must not exceed 500 characters').trim().optional().nullable(),
  city: z.string().max(100, 'City must not exceed 100 characters').trim().optional().nullable(),
  state: z.string().max(100, 'State must not exceed 100 characters').trim().optional().nullable(),
  country: z.string().max(100, 'Country must not exceed 100 characters').trim().optional().nullable(),
  pincode: z.string().max(10, 'Pincode must not exceed 10 characters').trim().optional().nullable(),
  contactPerson: z.string().max(200, 'Contact person must not exceed 200 characters').trim().optional().nullable(),
  contactPhone: z.string().max(20, 'Contact phone must not exceed 20 characters').trim().optional().nullable(),
  contactEmail: z.string().email('Invalid email format').max(200).trim().optional().nullable(),
  capacity: z.number().nonnegative('Capacity must be 0 or greater').optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  isVirtual: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Warehouse Query Schema
 * GET /api/warehouses
 */
export const warehouseQuerySchema = z.object({
  warehouseType: WarehouseTypeEnum.optional(),
  isActive: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
  search: z.string().max(100).optional(),
});

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const warehouseIdParamSchema = z.object({
  id: z.string().uuid('Invalid warehouse ID'),
});

export const warehouseTypeParamSchema = z.object({
  warehouseType: WarehouseTypeEnum,
});

export const warehouseCodeParamSchema = z.object({
  warehouseCode: z.string().min(1).max(20),
});

// Type exports for use in controllers
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type WarehouseQueryInput = z.infer<typeof warehouseQuerySchema>;
