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
export const createButtonSchema = z
  .object({
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
  })
  .passthrough();

/**
 * Update Button
 * PUT /api/materials/button/:id
 */
export const updateButtonSchema = z
  .object({
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
  })
  .passthrough();

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
 *
 * Field names match controller (thread.controller.ts) and frontend:
 * - threadName (required) - name of the thread
 * - brand - brand name e.g., Coats, Aster
 * - packagingType - CONE or TUBE
 * - piecesPerBox - auto-set based on packagingType if not provided
 * - metersPerUnit - meters per cone/tube
 * - coneSize - size of cone
 */
export const createThreadSchema = z
  .object({
    threadName: z.string().max(200),
    brand: z.string().max(50).optional(),
    packagingType: z.enum(['CONE', 'TUBE']).optional(),
    piecesPerBox: z.number().int().positive().optional().nullable(),
    metersPerUnit: z.number().positive().optional().nullable(),
    color: z.string().max(50).optional(),
    colorCode: z.string().max(50).optional(),
    coneSize: z.string().max(50).optional(),
    pricePerCone: z.number().nonnegative().optional().nullable(),
    supplierCode: z.string().max(50).optional(),
    buyerCode: z.string().max(50).optional(),
    supplierId: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional(),
    styleCodes: z.array(z.string()).optional(),
    suppliers: z.array(supplierAssociationSchema).optional(),
  })
  .passthrough();

/**
 * Update Thread
 * PUT /api/materials/thread/:id
 *
 * Same fields as create but all optional
 */
export const updateThreadSchema = z
  .object({
    threadName: z.string().max(200).optional(),
    brand: z.string().max(50).optional().nullable(),
    packagingType: z.enum(['CONE', 'TUBE']).optional().nullable(),
    piecesPerBox: z.number().int().positive().optional().nullable(),
    metersPerUnit: z.number().positive().optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    colorCode: z.string().max(50).optional().nullable(),
    coneSize: z.string().max(50).optional().nullable(),
    pricePerCone: z.number().nonnegative().optional().nullable(),
    supplierCode: z.string().max(50).optional().nullable(),
    buyerCode: z.string().max(50).optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    isActive: z.boolean().optional(),
    styleCodes: z.array(z.string()).optional(),
    suppliers: z.array(supplierAssociationSchema).optional(),
  })
  .passthrough();

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
 *
 * Field names match controller (zipper.controller.ts) and frontend:
 * - brand (not 'type') - zipper brand e.g., YKK
 * - sliderType (not 'pullerStyle') - slider style
 * - tapeWidth (new) - width of zipper tape
 * - teethType - metal, plastic, nylon coil, etc.
 */
export const createZipperSchema = z
  .object({
    zipperName: z.string().max(200).optional(),
    supplierCode: z.string().max(50).optional(),
    buyerCode: z.string().max(50).optional(),
    // Domain-specific field names (matching controller/frontend)
    brand: z.string().max(50).optional(),
    sliderType: z.string().max(50).optional(),
    tapeWidth: z.string().max(50).optional(),
    length: z.number().positive().optional().nullable(),
    color: z.string().max(50).optional(),
    teethType: z.string().max(50).optional(),
    pricePerPiece: z.number().nonnegative().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional(),
    styleCodes: z.array(z.string()).optional(),
    suppliers: z.array(supplierAssociationSchema).optional(),
  })
  .passthrough();

/**
 * Update Zipper
 * PUT /api/materials/zipper/:id
 */
export const updateZipperSchema = createZipperSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial()
  .passthrough();

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
 *
 * Field names match controller (elastic.controller.ts) and frontend:
 * - elasticType (not 'type') - type of elastic e.g., Braided, Knitted
 * - composition (not 'material') - material composition e.g., Nylon, Spandex
 * - stretchPercent (not 'stretch') - numeric stretch percentage
 */
export const createElasticSchema = z
  .object({
    elasticName: z.string().max(200).optional(),
    supplierCode: z.string().max(50).optional(),
    buyerCode: z.string().max(50).optional(),
    // Domain-specific field names (matching controller/frontend)
    elasticType: z.string().max(50).optional(),
    composition: z.string().max(100).optional(),
    stretchPercent: z.number().min(0).max(1000).optional().nullable(),
    width: z.number().positive().optional().nullable(),
    color: z.string().max(50).optional(),
    pricePerMeter: z.number().nonnegative().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional(),
    suppliers: z.array(supplierAssociationSchema).optional(),
  })
  .passthrough();

/**
 * Update Elastic
 * PUT /api/materials/elastic/:id
 */
export const updateElasticSchema = createElasticSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial()
  .passthrough();

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
 *
 * Field names match controller (label.controller.ts) and frontend:
 * - labelType (not 'type') - type of label e.g., Main Label, Size Label, Care Label
 * - labelCategory - SEWN_IN, HANGTAG, PRICE_TAG, etc.
 * - printMethod (not 'printType') - printing method
 * - content - label content text
 * - fabricContent - fabric composition (e.g., "100% Cotton")
 * - washcareInstructions - care instructions
 * - customerId - makes label customer-specific
 * - brandCategoryId - link to specific brand within customer
 */
export const createLabelSchema = z
  .object({
    labelName: z.string().max(200).optional(),
    supplierCode: z.string().max(50).optional(),
    buyerCode: z.string().max(50).optional(),
    // Domain-specific field names (matching controller/frontend)
    customerId: z.string().uuid().optional().nullable(),
    brandCategoryId: z.string().uuid().optional().nullable(),
    labelCategory: z.enum(['SEWN_IN', 'HANGTAG', 'PRICE_TAG']).optional(),
    labelType: z.string().max(50).optional(),
    sizeCategoryId: z.string().uuid().optional().nullable(),
    generateSizeVariants: z.boolean().optional().default(false),
    size: z.string().max(50).optional(),
    material: z.string().max(100).optional(),
    content: z.string().max(500).optional(),
    fabricContent: z.string().max(200).optional(),
    washcareInstructions: z.string().max(500).optional(),
    printMethod: z.string().max(50).optional(),
    color: z.string().max(50).optional(),
    pricePerPiece: z.number().nonnegative().optional().nullable(),
    pricePerHundred: z.number().nonnegative().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional(),
    styleCodes: z.array(z.string()).optional(),
    suppliers: z.array(supplierAssociationSchema).optional(),
  })
  .passthrough();

/**
 * Update Label
 * PUT /api/materials/label/:id
 */
export const updateLabelSchema = createLabelSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial()
  .passthrough();

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
 *
 * Field names match controller (lace.controller.ts) and frontend (LaceForm.tsx, material-quick-add.config.ts):
 * - laceType (not 'type') - type of lace e.g., Crochet, Embroidered
 * - composition (not 'material') - material composition e.g., Cotton, Nylon
 * - design (not 'pattern') - design pattern e.g., Floral, Geometric
 *
 * Greige lace support:
 * - isGreige: true = raw lace needing dyeing, false = ready-to-use finished lace
 * - expectedShrinkagePercent: shrinkage during dyeing (for greige)
 * - costPerMeterGreige: raw material cost (for greige)
 * - sourceGreigeLaceId: links finished lace to its source greige for traceability
 *
 * NOTE: laceCode is auto-generated, widthUnit/pricePerRoll/metersPerRoll/supplierId not used by controller
 */
export const createLaceSchema = z
  .object({
    laceName: z.string().max(200).optional(),
    supplierCode: z.string().max(50).optional(),
    buyerCode: z.string().max(50).optional(),
    // Domain-specific field names (matching controller/frontend)
    laceType: z.string().max(50).optional(),
    composition: z.string().max(100).optional(),
    design: z.string().max(100).optional(),
    width: z.number().positive().optional().nullable(),
    color: z.string().max(50).optional(),
    pricePerMeter: z.number().nonnegative().optional().nullable(),
    description: z.string().max(1000).optional(),
    styleCodes: z.array(z.string()).optional(),
    suppliers: z.array(supplierAssociationSchema).optional(),
    // Greige lace support
    isGreige: z.boolean().optional().default(false),
    expectedShrinkagePercent: z.number().min(0).max(100).optional().nullable(),
    costPerMeterGreige: z.number().nonnegative().optional().nullable(),
    sourceGreigeLaceId: z.string().uuid().optional().nullable(),
  })
  .passthrough();

/**
 * Update Lace
 * PUT /api/materials/lace/:id
 */
export const updateLaceSchema = createLaceSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial()
  .passthrough();

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
 *
 * Field names match controller (packaging.controller.ts) and frontend:
 * - packagingType (not 'type') - type of packaging e.g., Polybag, Carton, Hanger
 * - thickness (not 'dimensions') - thickness e.g., "40 microns", "3 ply"
 * - printDetails - printing details for branded packaging
 * - customerId - makes packaging customer-specific
 * - brandCategoryId - link to specific brand within customer
 */
export const createPackagingSchema = z
  .object({
    packagingName: z.string().max(200).optional(),
    supplierCode: z.string().max(50).optional(),
    buyerCode: z.string().max(50).optional(),
    // Domain-specific field names (matching controller/frontend)
    customerId: z.string().uuid().optional().nullable(),
    brandCategoryId: z.string().uuid().optional().nullable(),
    packagingType: z.string().max(50).optional(),
    size: z.string().max(50).optional(),
    material: z.string().max(100).optional(),
    thickness: z.string().max(100).optional(),
    printDetails: z.string().max(500).optional(),
    pricePerPiece: z.number().nonnegative().optional().nullable(),
    pricePerHundred: z.number().nonnegative().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional(),
    styleCodes: z.array(z.string()).optional(),
    suppliers: z.array(supplierAssociationSchema).optional(),
  })
  .passthrough();

/**
 * Update Packaging
 * PUT /api/materials/packaging/:id
 */
export const updatePackagingSchema = createPackagingSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial()
  .passthrough();

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
