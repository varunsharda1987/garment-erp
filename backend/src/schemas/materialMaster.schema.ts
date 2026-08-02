/**
 * Material Master Validation Schemas
 *
 * Zod schemas for unified material master CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const MaterialTypeEnum = z.enum([
  'GENERIC',
  'TRIMS',
  'LACE',
  'BUTTON',
  'THREAD',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'PACKAGING',
  'ACCESSORIES',
  'SERVICE',
  'MACHINE_PART',
  'OTHER',
  'FABRIC',
  'GREIGE',
  'HOOK_EYE',
  'SNAP_BUTTON',
  'BUCKLE',
  'BELT',
  'VELCRO',
  'DRAWSTRING',
  'RIBBON',
  'SEQUIN',
  'BEAD',
  'MOTIF',
  'INTERLINING',
  'PADDING',
  'OTHER_FASTENER',
  'OTHER_TAPE',
  'OTHER_DECORATIVE',
  'OTHER_FUNCTIONAL',
  'OTHER_MATERIAL',
]);

// ============================================================================
// MATERIAL MASTER SCHEMAS
// ============================================================================

/**
 * Create Material
 * POST /api/materials
 */
export const createMaterialSchema = z.object({
  materialType: MaterialTypeEnum,
  code: z.string().max(50).optional(),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  unit: z.string().max(20).optional().default('PIECE'),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  pricePerUnit: z.number().nonnegative().optional().nullable(),
  pricePerMeter: z.number().nonnegative().optional().nullable(),
  pricePerPiece: z.number().nonnegative().optional().nullable(),
  pricePerKg: z.number().nonnegative().optional().nullable(),
  pricePerGross: z.number().nonnegative().optional().nullable(),
  currencyId: z.string().optional().nullable(),
  minOrderQty: z.number().int().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  hsnCode: z.string().max(20).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  specifications: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional().default(true),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Material
 * PUT /api/materials/:id
 */
export const updateMaterialSchema = z.object({
  materialType: MaterialTypeEnum.optional(),
  code: z.string().max(50).optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  unit: z.string().max(20).optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  pricePerUnit: z.number().nonnegative().optional().nullable(),
  pricePerMeter: z.number().nonnegative().optional().nullable(),
  pricePerPiece: z.number().nonnegative().optional().nullable(),
  pricePerKg: z.number().nonnegative().optional().nullable(),
  pricePerGross: z.number().nonnegative().optional().nullable(),
  currencyId: z.string().optional().nullable(),
  minOrderQty: z.number().int().nonnegative().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  hsnCode: z.string().max(20).optional().nullable(),
  gstRate: z.number().min(0).max(100).optional().nullable(),
  specifications: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Add Material Supplier
 * POST /api/materials/:id/suppliers
 *
 * Field names must match MaterialSupplierMappingDto in material-master.types.ts
 * and what service/material-master.service.ts::addSupplier expects.
 */
export const addMaterialSupplierSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  supplierCode: z.string().max(50).optional(),
  supplierName: z.string().max(200).optional(),
  supplierPrice: z.number().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  moq: z.number().int().nonnegative().optional(),
  moqUnit: z.string().max(20).optional(),
  isPrimary: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

/**
 * Query Materials
 * GET /api/materials
 */
export const materialQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  materialType: MaterialTypeEnum.optional(),
  active: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
  supplierId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
});

// ============================================================================
// Param Schemas
// ============================================================================

export const materialIdParamSchema = z.object({
  id: z.string().min(1, 'Material ID is required'),
});

export const materialTypeParamSchema = z.object({
  type: MaterialTypeEnum,
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type AddMaterialSupplierInput = z.infer<typeof addMaterialSupplierSchema>;
export type MaterialQueryInput = z.infer<typeof materialQuerySchema>;
