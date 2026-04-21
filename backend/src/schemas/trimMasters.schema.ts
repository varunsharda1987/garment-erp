/**
 * Trim Masters Validation Schemas
 *
 * Zod schemas for button, thread, zipper, elastic, label, lace, packaging endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Supplier Association (common to all trim masters)
 */
export const supplierAssociationSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  isPreferred: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  pricePerPiece: z.number().nonnegative().optional().nullable(),
  pricePerGross: z.number().nonnegative().optional().nullable(),
  pricePerMeter: z.number().nonnegative().optional().nullable(),
  pricePerUnit: z.number().nonnegative().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  moq: z.number().nonnegative().optional(),
});

/**
 * Common Query Params (shared by all trim masters)
 */
export const trimMasterQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  supplierId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

// ============================================================================
// BUTTON SCHEMAS
// ============================================================================

/**
 * Create Button
 * POST /api/materials/button
 */
export const createButtonSchema = z.object({
  buttonName: z.string().max(200).optional(),
  supplierCode: z.string().max(50).optional(),
  buyerCode: z.string().max(50).optional(),
  size: z.string().max(50).optional(),
  holes: z.number().int().min(0).max(10).optional().nullable(),
  color: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  shape: z.string().max(50).optional(),
  pricePerPiece: z.number().nonnegative().optional().nullable(),
  pricePerGross: z.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional(),
  styleCodes: z.array(z.string()).optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Update Button
 * PUT /api/materials/button/:id
 */
export const updateButtonSchema = z.object({
  buttonName: z.string().max(200).optional(),
  supplierCode: z.string().max(50).optional().nullable(),
  buyerCode: z.string().max(50).optional().nullable(),
  size: z.string().max(50).optional().nullable(),
  holes: z.number().int().min(0).max(10).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  material: z.string().max(100).optional().nullable(),
  shape: z.string().max(50).optional().nullable(),
  pricePerPiece: z.number().nonnegative().optional().nullable(),
  pricePerGross: z.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  styleCodes: z.array(z.string()).optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Bulk Import Button
 * POST /api/materials/button/bulk-import
 */
export const bulkImportButtonSchema = z.object({
  data: z.array(createButtonSchema).min(1, 'At least one item required').max(500, 'Maximum 500 items'),
  createStock: z.boolean().optional().default(false),
});

// ============================================================================
// THREAD SCHEMAS
// ============================================================================

/**
 * Create Thread
 * POST /api/materials/thread
 */
export const createThreadSchema = z.object({
  threadName: z.string().max(200).optional(),
  supplierCode: z.string().max(50).optional(),
  buyerCode: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  colorFamily: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  count: z.string().max(50).optional(),
  ply: z.number().int().positive().optional().nullable(),
  finish: z.string().max(50).optional(),
  metersPerCone: z.number().positive().optional().nullable(),
  conesPerBox: z.number().int().positive().optional().nullable(),
  pricePerCone: z.number().nonnegative().optional().nullable(),
  pricePerBox: z.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional(),
  styleCodes: z.array(z.string()).optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Update Thread
 * PUT /api/materials/thread/:id
 */
export const updateThreadSchema = z.object({
  threadName: z.string().max(200).optional(),
  supplierCode: z.string().max(50).optional().nullable(),
  buyerCode: z.string().max(50).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  colorFamily: z.string().max(50).optional().nullable(),
  material: z.string().max(100).optional().nullable(),
  count: z.string().max(50).optional().nullable(),
  ply: z.number().int().positive().optional().nullable(),
  finish: z.string().max(50).optional().nullable(),
  metersPerCone: z.number().positive().optional().nullable(),
  conesPerBox: z.number().int().positive().optional().nullable(),
  pricePerCone: z.number().nonnegative().optional().nullable(),
  pricePerBox: z.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Convert Thread Quantity
 * POST /api/materials/thread/convert
 */
export const convertThreadSchema = z.object({
  threadId: z.string().uuid('Invalid thread ID'),
  fromUnit: z.enum(['METER', 'CONE', 'BOX']),
  toUnit: z.enum(['METER', 'CONE', 'BOX']),
  quantity: z.number().positive('Quantity must be positive'),
});

/**
 * Bulk Import Thread
 * POST /api/materials/thread/bulk-import
 */
export const bulkImportThreadSchema = z.object({
  data: z.array(createThreadSchema).min(1).max(500),
  createStock: z.boolean().optional().default(false),
});

// ============================================================================
// ZIPPER SCHEMAS
// ============================================================================

/**
 * Create Zipper
 * POST /api/materials/zipper
 */
export const createZipperSchema = z.object({
  zipperName: z.string().max(200).optional(),
  supplierCode: z.string().max(50).optional(),
  buyerCode: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  size: z.string().max(50).optional(),
  length: z.number().positive().optional().nullable(),
  lengthUnit: z.enum(['CM', 'INCH']).optional(),
  color: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  teethType: z.string().max(50).optional(),
  pullerStyle: z.string().max(50).optional(),
  pricePerPiece: z.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional(),
  styleCodes: z.array(z.string()).optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Update Zipper
 * PUT /api/materials/zipper/:id
 */
export const updateZipperSchema = z.object({
  zipperName: z.string().max(200).optional(),
  supplierCode: z.string().max(50).optional().nullable(),
  buyerCode: z.string().max(50).optional().nullable(),
  type: z.string().max(50).optional().nullable(),
  size: z.string().max(50).optional().nullable(),
  length: z.number().positive().optional().nullable(),
  lengthUnit: z.enum(['CM', 'INCH']).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  material: z.string().max(100).optional().nullable(),
  teethType: z.string().max(50).optional().nullable(),
  pullerStyle: z.string().max(50).optional().nullable(),
  pricePerPiece: z.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Bulk Import Zipper
 * POST /api/materials/zipper/bulk-import
 */
export const bulkImportZipperSchema = z.object({
  data: z.array(createZipperSchema).min(1).max(500),
  createStock: z.boolean().optional().default(false),
});

// ============================================================================
// ELASTIC SCHEMAS
// ============================================================================

/**
 * Create Elastic
 * POST /api/materials/elastic
 */
export const createElasticSchema = z.object({
  elasticName: z.string().max(200).optional(),
  supplierCode: z.string().max(50).optional(),
  buyerCode: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  width: z.number().positive().optional().nullable(),
  widthUnit: z.enum(['MM', 'CM', 'INCH']).optional(),
  color: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  stretch: z.string().max(50).optional(),
  pricePerMeter: z.number().nonnegative().optional().nullable(),
  pricePerRoll: z.number().nonnegative().optional().nullable(),
  metersPerRoll: z.number().positive().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional(),
  styleCodes: z.array(z.string()).optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Update Elastic
 * PUT /api/materials/elastic/:id
 */
export const updateElasticSchema = createElasticSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial();

/**
 * Bulk Import Elastic
 * POST /api/materials/elastic/bulk-import
 */
export const bulkImportElasticSchema = z.object({
  data: z.array(createElasticSchema).min(1).max(500),
  createStock: z.boolean().optional().default(false),
});

// ============================================================================
// LABEL SCHEMAS
// ============================================================================

/**
 * Create Label
 * POST /api/materials/label
 */
export const createLabelSchema = z.object({
  labelName: z.string().max(200).optional(),
  supplierCode: z.string().max(50).optional(),
  buyerCode: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  size: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  printType: z.string().max(50).optional(),
  foldType: z.string().max(50).optional(),
  pricePerPiece: z.number().nonnegative().optional().nullable(),
  pricePerThousand: z.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional(),
  styleCodes: z.array(z.string()).optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Update Label
 * PUT /api/materials/label/:id
 */
export const updateLabelSchema = createLabelSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial();

/**
 * Bulk Import Label
 * POST /api/materials/label/bulk-import
 */
export const bulkImportLabelSchema = z.object({
  data: z.array(createLabelSchema).min(1).max(500),
  createStock: z.boolean().optional().default(false),
});

// ============================================================================
// LACE SCHEMAS
// ============================================================================

/**
 * Create Lace
 * POST /api/materials/lace
 */
export const createLaceSchema = z.object({
  laceName: z.string().max(200).optional(),
  laceCode: z.string().max(50).optional(),
  supplierCode: z.string().max(50).optional(),
  buyerCode: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  width: z.number().positive().optional().nullable(),
  widthUnit: z.enum(['MM', 'CM', 'INCH']).optional(),
  color: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  pattern: z.string().max(100).optional(),
  pricePerMeter: z.number().nonnegative().optional().nullable(),
  pricePerRoll: z.number().nonnegative().optional().nullable(),
  metersPerRoll: z.number().positive().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional(),
  styleCodes: z.array(z.string()).optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Update Lace
 * PUT /api/materials/lace/:id
 */
export const updateLaceSchema = createLaceSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial();

/**
 * Bulk Import Lace
 * POST /api/materials/lace/bulk-import
 */
export const bulkImportLaceSchema = z.object({
  data: z.array(createLaceSchema).min(1).max(500),
  createStock: z.boolean().optional().default(false),
});

// ============================================================================
// PACKAGING SCHEMAS
// ============================================================================

/**
 * Create Packaging
 * POST /api/materials/packaging
 */
export const createPackagingSchema = z.object({
  packagingName: z.string().max(200).optional(),
  supplierCode: z.string().max(50).optional(),
  buyerCode: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  size: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  dimensions: z.string().max(100).optional(),
  pricePerPiece: z.number().nonnegative().optional().nullable(),
  pricePerBundle: z.number().nonnegative().optional().nullable(),
  piecesPerBundle: z.number().int().positive().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  description: z.string().max(1000).optional(),
  styleCodes: z.array(z.string()).optional(),
  suppliers: z.array(supplierAssociationSchema).optional(),
});

/**
 * Update Packaging
 * PUT /api/materials/packaging/:id
 */
export const updatePackagingSchema = createPackagingSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial();

/**
 * Bulk Import Packaging
 * POST /api/materials/packaging/bulk-import
 */
export const bulkImportPackagingSchema = z.object({
  data: z.array(createPackagingSchema).min(1).max(500),
  createStock: z.boolean().optional().default(false),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateButtonInput = z.infer<typeof createButtonSchema>;
export type UpdateButtonInput = z.infer<typeof updateButtonSchema>;
export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;
export type ConvertThreadInput = z.infer<typeof convertThreadSchema>;
export type CreateZipperInput = z.infer<typeof createZipperSchema>;
export type UpdateZipperInput = z.infer<typeof updateZipperSchema>;
export type CreateElasticInput = z.infer<typeof createElasticSchema>;
export type UpdateElasticInput = z.infer<typeof updateElasticSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type CreateLaceInput = z.infer<typeof createLaceSchema>;
export type UpdateLaceInput = z.infer<typeof updateLaceSchema>;
export type CreatePackagingInput = z.infer<typeof createPackagingSchema>;
export type UpdatePackagingInput = z.infer<typeof updatePackagingSchema>;
export type TrimMasterQueryInput = z.infer<typeof trimMasterQuerySchema>;
