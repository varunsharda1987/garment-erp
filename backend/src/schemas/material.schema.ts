import { z } from 'zod';

/**
 * Material Unit Enum - matches Prisma Unit enum
 */
export const MaterialUnitEnum = z.enum(['METER', 'PIECE', 'KILOGRAM', 'SET', 'YARD', 'DOZEN', 'GROSS', 'TUBE', 'CONE']);

/**
 * Supplier relationship schema for materials
 */
export const materialSupplierSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID format'),
  isPreferred: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  notes: z.string().optional(),
  supplierPrice: z.number().nonnegative('Supplier price must be non-negative').optional().nullable(),
  leadTimeDays: z.number().int('Lead time must be an integer').nonnegative().optional().nullable(),
  moq: z.number().nonnegative('MOQ must be non-negative').optional().nullable(),
  moqUnit: z.string().optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
});

/**
 * Create Material Schema
 * POST /api/materials
 */
export const createMaterialSchema = z.object({
  code: z
    .string()
    .min(2, 'Material code must be at least 2 characters')
    .max(50, 'Material code must not exceed 50 characters')
    .trim(),
  name: z
    .string()
    .min(2, 'Material name must be at least 2 characters')
    .max(200, 'Material name must not exceed 200 characters')
    .trim(),
  categoryId: z.string().uuid('Invalid category ID format'),
  unit: MaterialUnitEnum,
  description: z.string().trim().optional(),
  specifications: z.string().trim().optional(),
  hsnCode: z.string().trim().optional(),
  gstRate: z.union([z.number(), z.string().transform((val) => (val ? parseFloat(val) : undefined))]).optional(),
  minimumStock: z.number().nonnegative('Minimum stock must be non-negative').optional(),
  reorderLevel: z
    .number()
    .int('Reorder level must be an integer')
    .nonnegative('Reorder level must be non-negative')
    .optional(),
  leadTime: z.number().int('Lead time must be an integer').nonnegative('Lead time must be non-negative').optional(),
  supplierId: z.string().uuid('Invalid supplier ID format').optional(),
  costPerUnit: z.number().nonnegative('Cost per unit must be non-negative').optional(),
  suppliers: z.array(materialSupplierSchema).optional().default([]),
  image: z.string().optional(),
  categoryData: z.unknown().optional(),
});

/**
 * Update Material Schema
 * PUT /api/materials/:id
 */
export const updateMaterialSchema = z.object({
  code: z
    .string()
    .min(2, 'Material code must be at least 2 characters')
    .max(50, 'Material code must not exceed 50 characters')
    .trim()
    .optional(),
  name: z
    .string()
    .min(2, 'Material name must be at least 2 characters')
    .max(200, 'Material name must not exceed 200 characters')
    .trim()
    .optional(),
  categoryId: z.string().uuid('Invalid category ID format').optional(),
  unit: MaterialUnitEnum.optional(),
  description: z.string().trim().optional(),
  specifications: z.string().trim().optional(),
  hsnCode: z.string().trim().optional(),
  gstRate: z.union([z.number(), z.string().transform((val) => (val ? parseFloat(val) : undefined))]).optional(),
  minimumStock: z.number().nonnegative('Minimum stock must be non-negative').optional(),
  reorderLevel: z
    .number()
    .int('Reorder level must be an integer')
    .nonnegative('Reorder level must be non-negative')
    .optional(),
  leadTime: z.number().int('Lead time must be an integer').nonnegative('Lead time must be non-negative').optional(),
  supplierId: z.string().uuid('Invalid supplier ID format').optional(),
  costPerUnit: z.number().nonnegative('Cost per unit must be non-negative').optional(),
  suppliers: z.array(materialSupplierSchema).optional(),
  image: z.string().optional(),
  categoryData: z.unknown().optional(),
});

/**
 * Material Query Schema
 * GET /api/materials
 */
export const materialQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(1000, 'Limit must not exceed 1000')),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid('Invalid category ID format').optional(),
  supplierId: z.string().uuid('Invalid supplier ID format').optional(),
  unit: MaterialUnitEnum.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true';
    })
    .pipe(z.boolean().optional()),
});

/**
 * Material ID Param Schema
 * Validates material ID in route parameters
 * Supports both UUID format and custom format (e.g., mat-lace-0004, mat-btn-0001)
 */
export const materialIdParamSchema = z.object({
  id: z.string().min(1, 'Material ID is required'),
});

/**
 * Category Query Schema
 * GET /api/materials/categories
 */
export const categoryQuerySchema = z.object({
  parentId: z.string().uuid('Invalid parent category ID format').optional(),
});

/**
 * Create Category Schema
 * POST /api/materials/categories
 */
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name must not exceed 100 characters')
    .trim(),
  description: z.string().trim().optional(),
});

// Type exports for use in controllers
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type MaterialQueryInput = z.infer<typeof materialQuerySchema>;
export type MaterialIdParamInput = z.infer<typeof materialIdParamSchema>;
export type MaterialSupplierInput = z.infer<typeof materialSupplierSchema>;
export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type MaterialUnit = z.infer<typeof MaterialUnitEnum>;
