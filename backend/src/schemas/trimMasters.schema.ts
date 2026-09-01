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
  // pricePerHundred is used by label_suppliers and packaging_suppliers
  pricePerHundred: z.number().nonnegative().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  moq: z.number().nonnegative().optional(),
});

/**
 * Param Validation (shared by all trim masters)
 */
export const trimMasterIdParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

/**
 * Common Query Params (shared by all trim masters)
 *
 * NOTE: customerId and brandCategoryId are used by packaging and label controllers
 * to filter items by customer/brand. They are optional here for shared use.
 */
export const trimMasterQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  supplierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  brandCategoryId: z.string().uuid().optional(),
  // labelCategory used by Label controller for filtering SEWN_IN, HANGTAG, PRICE_TAG
  labelCategory: z.enum(['SEWN_IN', 'HANGTAG', 'PRICE_TAG']).optional(),
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
    // Controller does parseInt(holes) - coerce to handle string inputs from forms
    holes: z.coerce.number().int().min(0).max(10).optional().nullable(),
    color: z.string().max(50).optional(),
    material: z.string().max(100).optional(),
    shape: z.string().max(50).optional(),
    // Controller does parseFloat on prices - coerce to handle string inputs
    pricePerPiece: z.coerce.number().nonnegative().optional().nullable(),
    pricePerGross: z.coerce.number().nonnegative().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional(),
    styleCodes: z.array(z.string()).optional(),
    suppliers: z.array(supplierAssociationSchema).optional(),
    // Bulk import fields - used by bulkImportButtons controller
    stockQuantity: z.coerce.number().nonnegative().optional().nullable(),
    purchaseCost: z.coerce.number().nonnegative().optional().nullable(),
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
    // Controller does parseInt(holes) - coerce to handle string inputs
    holes: z.coerce.number().int().min(0).max(10).optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    material: z.string().max(100).optional().nullable(),
    shape: z.string().max(50).optional().nullable(),
    // Controller does parseFloat on prices - coerce to handle string inputs
    pricePerPiece: z.coerce.number().nonnegative().optional().nullable(),
    pricePerGross: z.coerce.number().nonnegative().optional().nullable(),
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
    packagingType: z.enum(['CONE', 'TUBE', 'SPOOL', 'CONE_5K', 'CONE_10K']).optional(),
    piecesPerBox: z.number().int().positive().optional().nullable(),
    metersPerUnit: z.number().positive().optional().nullable(),
    color: z.string().max(50).optional(),
    colorCode: z.string().max(50).optional(),
    colorId: z.string().uuid().optional().nullable(),
    coneSize: z.string().max(50).optional(),
    ply: z.number().int().positive().optional().nullable(),
    materialComposition: z.string().max(200).optional().nullable(),
    unitsPerBox: z.number().int().positive().optional().nullable(),
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
    packagingType: z.enum(['CONE', 'TUBE', 'SPOOL', 'CONE_5K', 'CONE_10K']).optional().nullable(),
    piecesPerBox: z.number().int().positive().optional().nullable(),
    metersPerUnit: z.number().positive().optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    colorCode: z.string().max(50).optional().nullable(),
    colorId: z.string().uuid().optional().nullable(),
    coneSize: z.string().max(50).optional().nullable(),
    ply: z.number().int().positive().optional().nullable(),
    materialComposition: z.string().max(200).optional().nullable(),
    unitsPerBox: z.number().int().positive().optional().nullable(),
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
// Matches the controller (convertThreadQuantity) and the ThreadQuantityInput UI, which send
// {ply, packagingType, inputType, value}. The previous {threadId, fromUnit, toUnit, quantity} shape
// shared NO field with either side, so every conversion call 400'd — the quantity converter failed
// on each keystroke.
export const convertThreadSchema = z.object({
  ply: z.string().min(1, 'Ply is required'),
  packagingType: z.string().min(1, 'Packaging type is required'),
  inputType: z.enum(['UNITS', 'BOXES', 'METERS']),
  value: z.number().nonnegative('Value must be zero or greater'),
});

/**
 * Bulk Import Thread
 * POST /api/materials/thread/bulk-import
 */
export const bulkImportThreadSchema = z.object({
  data: z.array(createThreadSchema).min(1).max(500),
  createStock: z.boolean().optional().default(false),
});

/**
 * Thread Master Stock Query Params
 * GET /api/materials/thread/:id/stock
 *
 * BUG-TH5 FIX: Validates requiredUnits query param to prevent parseFloat("abc") → NaN
 * Named threadMasterStockQuerySchema to avoid collision with threadStock.schema.ts
 */
export const threadMasterStockQuerySchema = z.object({
  requiredUnits: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(parseFloat(v)), { message: 'Required units must be a valid number' })
    .transform((v) => (v ? parseFloat(v) : undefined))
    .pipe(z.number().nonnegative('Required units must be non-negative').optional()),
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
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
    // Decimal(10,2) column and ZipperForm sends Number(data.tapeWidth) — z.string() rejected it, so
    // saving a zipper with a tape width 400'd every time.
    tapeWidth: z.coerce.number().nonnegative().optional(),
    length: z.number().positive().optional().nullable(),
    color: z.string().max(50).optional(),
    teethType: z.string().max(50).optional(),
    pricePerPiece: z.number().nonnegative().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional(),
    // BUG-MM6 FIX: styleCodes now supported - zipper_style_associations table added
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
    // Controller does parseFloat(stretchPercent) - coerce to handle string inputs from forms
    stretchPercent: z.coerce.number().min(0).max(1000).optional().nullable(),
    // Controller does parseFloat(width) - coerce to handle string inputs from forms
    width: z.coerce.number().positive().optional().nullable(),
    color: z.string().max(50).optional(),
    // Controller does parseFloat(pricePerMeter) - coerce to handle string inputs from forms
    pricePerMeter: z.coerce.number().nonnegative().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional(),
    // BUG-BEL6 FIX: Removed styleCodes - no elastic_style_associations table in Prisma,
    // controller doesn't handle it, accepting it causes silent data loss
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
    // BUG-BEL2 FIX: Removed styleCodes - no label_style_associations table in Prisma,
    // controller doesn't handle it, accepting it causes silent data loss
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

// Helper to coerce string "true"/"false" to boolean (for FormData multipart uploads)
const coerceBooleanFromFormData = z.preprocess((val) => {
  if (typeof val === 'string') {
    if (val === 'true') return true;
    if (val === 'false') return false;
  }
  return val;
}, z.boolean().optional().default(false));

// Helper to parse JSON string arrays (for FormData multipart uploads)
const coerceArrayFromFormData = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }, z.array(itemSchema).optional());

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
 * NOTE: Supports multipart/form-data for image uploads - boolean and array fields use coercion helpers
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
    // Controller does parseFloat(width) - coerce to handle string inputs from forms
    width: z.coerce.number().positive().optional().nullable(),
    color: z.string().max(50).optional(),
    // Controller does parseFloat(pricePerMeter) - coerce to handle string inputs
    pricePerMeter: z.coerce.number().nonnegative().optional().nullable(),
    description: z.string().max(1000).optional(),
    // Arrays may come as JSON strings when using FormData (multipart image upload)
    styleCodes: coerceArrayFromFormData(z.string()),
    suppliers: coerceArrayFromFormData(supplierAssociationSchema),
    // Greige lace support - boolean may come as string "true"/"false" from FormData
    isGreige: coerceBooleanFromFormData,
    // Controller does parseFloat() on these - coerce to handle string inputs
    expectedShrinkagePercent: z.coerce.number().min(0).lt(100).optional().nullable(), // MRP-48h: lt(100) not max(100) — this feeds `1 - x/100` as a divisor; 100 is a divide-by-zero
    costPerMeterGreige: z.coerce.number().nonnegative().optional().nullable(),
    sourceGreigeLaceId: z.string().uuid().optional().nullable(),
  })
  .passthrough();

/**
 * Update Lace
 * PUT /api/materials/lace/:id
 */
export const updateLaceSchema = createLaceSchema
  .extend({
    // isActive may come as string "true"/"false" from FormData (multipart image upload)
    isActive: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val === 'true') return true;
        if (val === 'false') return false;
      }
      return val;
    }, z.boolean().optional()),
  })
  .partial()
  .passthrough();

/**
 * Create (or reuse) the DYED VARIANT of a greige lace.
 * POST /api/materials/lace/dyed-variant
 *
 * Lets a greige lace be dyed to a colour without a detour to the full lace form. The finished
 * variant is what carries the dyed stock identity (lace_stock is keyed by laceId and has no
 * colour column), so one variant per greige+colour is the unit of identity — hence the dedupe.
 */
export const createDyedLaceVariantSchema = z.object({
  greigeLaceId: z.string().uuid('A source greige lace is required'),
  color: z.string().min(1, 'Target colour is required').max(50),
  // Optional provenance captured at creation; all are nullable because a cost sheet is often
  // drafted before the processor is chosen or the lab dip is raised.
  processorId: z.string().uuid().optional().nullable(),
  labDipId: z.string().uuid().optional().nullable(),
  styleCode: z.string().max(50).optional().nullable(),
  pricePerMeter: z.coerce.number().nonnegative().optional().nullable(),
});

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
    // Removed styleCodes - no packaging_style_associations table in Prisma,
    // controller doesn't handle it, accepting it causes silent data loss
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
export type CreateDyedLaceVariantInput = z.infer<typeof createDyedLaceVariantSchema>;
export type CreatePackagingInput = z.infer<typeof createPackagingSchema>;
export type UpdatePackagingInput = z.infer<typeof updatePackagingSchema>;
export type TrimMasterQueryInput = z.infer<typeof trimMasterQuerySchema>;
export type ThreadMasterStockQueryInput = z.infer<typeof threadMasterStockQuerySchema>;
