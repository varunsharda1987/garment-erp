import { z } from 'zod';

// Helper for validating IDs that can be UUID or CUID (some masters use CUID)
const isValidIdFormat = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val);

// ============================================================================
// ENUMS
// ============================================================================

export const StyleStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);

export const CADStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'APPROVED']);

export const GenderEnum = z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']);

export const AgeGroupEnum = z.enum(['ADULT', 'KIDS_1_3Y', 'KIDS_4_7Y', 'KIDS_8_14Y']);

export const FabricFinishTypeEnum = z.enum(['DYED', 'PRINTED', 'YARN_DYED', 'RAW']);

export const ProcessTypeEnum = z.enum([
  'PRINTING',
  'DYEING',
  'EMBROIDERY',
  'CUTTING',
  'STITCHING',
  'FINISHING',
  'WASHING',
  'TRANSPORTATION',
  'HANDWORK',
  'SMOCKING',
]);

// ============================================================================
// NESTED SCHEMAS (Components, Fabrics, Processes, etc.)
// ============================================================================

// Style Fabric Schema
export const styleFabricSchema = z.object({
  fabricId: z.string().uuid().optional().nullable(),
  fabricCADId: z.string().uuid().optional().nullable(),
  fabricFinishType: FabricFinishTypeEnum.optional().nullable(),
  cadGroupKey: z.string().optional().nullable(),
  fabricName: z.string().optional().nullable(),
  fabricType: z.string().optional().nullable(),
  greigeName: z.string().optional().nullable(),
  genericGreigeName: z.string().optional().nullable(),
  quantityNeeded: z.number().nonnegative().optional().nullable(),
  unitPrice: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Embroidery support
  hasEmbroidery: z.boolean().optional().default(false),
  // embroideryId accepts CUID (embroidery_master uses @default(cuid()))
  embroideryId: z
    .string()
    .refine(
      (val) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val),
      {
        message: 'Invalid ID format (expected UUID or CUID)',
      }
    )
    .optional()
    .nullable(),
  // Design/Color identification (for PRINTED/YARN_DYED and SOLID/DYED fabrics)
  printDesign: z.string().optional().nullable(),
  // colorMasterId accepts CUID (color_master uses @default(cuid()))
  colorMasterId: z
    .string()
    .refine(
      (val) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val),
      {
        message: 'Invalid ID format (expected UUID or CUID)',
      }
    )
    .optional()
    .nullable(),
  // Pattern parts
  patternPartIds: z.array(z.string().uuid()).optional().default([]),
});

// Style Component Schema
export const styleComponentSchema = z.object({
  componentName: z.string().min(1, 'Component name is required'),
  componentType: z.string().optional().nullable(),
  fabrics: z.array(styleFabricSchema).optional().default([]),
});

// Helper to coerce any value to number (handles Prisma Decimal objects, strings, etc.)
const coerceAnyToNumber = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  }
  // Handle Prisma Decimal objects or any other objects
  if (typeof val === 'object') {
    // Try to convert to string first (Prisma Decimal has toString())
    const str = String(val);
    const parsed = parseFloat(str);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}, z.number().nonnegative().nullable());

// Style Process Schema - processName optional since it can be derived from processType
export const styleProcessSchema = z.object({
  processName: z.string().optional(),
  processType: z.string().optional(), // Accept any string, not just enum values
  isRequired: z.boolean().optional().default(true),
  supplierId: z.string().uuid().optional().nullable(),
  estimatedCost: coerceAnyToNumber.optional(), // Accept number, string, or object and coerce to number
  estimatedDays: z.number().int().nonnegative().optional().nullable(),
  description: z.string().optional().nullable(), // Frontend sends description
  notes: z.string().optional().nullable(),
});

// Material BOM Schema - Accept extra fields from frontend
export const materialBOMSchema = z.object({
  materialType: z.string().min(1, 'Material type is required'),
  materialId: z.string().optional().nullable(),
  materialCode: z.string().optional().nullable(), // Extra field from frontend
  materialName: z.string().optional().nullable(), // Extra field from frontend
  usageCategory: z.string().optional().default('GARMENT_TRIM'),
  componentName: z.string().optional().nullable(),
  quantityPerGarment: z.number().nonnegative().optional().default(0),
  unit: z.string().optional().default('pcs'),
  unitPrice: z.number().nonnegative().optional().nullable(),
  totalCost: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Legacy: Garment Trims Schema (deprecated)
export const garmentTrimSchema = z.object({
  trimName: z.string().min(1, 'Trim name is required'),
  trimType: z.string().optional().default(''),
  quantityPerPiece: z.number().nonnegative().optional().default(0),
  unit: z.string().optional().default('pcs'),
  supplier: z.string().optional().nullable(),
});

// Legacy: Value Additions Schema (deprecated)
export const valueAdditionSchema = z.object({
  additionType: z.string().min(1, 'Addition type is required'),
  description: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  numberOfItems: z.string().optional().nullable(),
});

// Legacy: Packaging Trims Schema (deprecated)
export const packagingTrimSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  itemType: z.string().optional().default('polybag'),
  specification: z.string().optional().nullable(),
  quantityPerPack: z.number().int().positive().optional().default(1),
});

// SKU Variant Schema - Allow empty for draft saves
export const skuVariantSchema = z.object({
  size: z.string().optional().default(''),
  sku: z.string().optional().default(''),
  barcode: z.string().optional().nullable(),
  accountingSKU: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

// Style Trim Schema (simplified trim references)
// masterId can be a UUID or a special value like 'auto-thread' for auto-generated trims
export const styleTrimSchema = z.object({
  trimType: z.string().min(1, 'Trim type is required'),
  masterId: z.string().min(1, 'Master ID is required'),
  masterCode: z.string().optional(),
  masterName: z.string().optional(),
  color: z.string().optional().nullable(),
});

// ============================================================================
// CREATE STYLE SCHEMA
// ============================================================================
// NOTE: Fabrics are defined via components[].fabrics[] using styleFabricSchema (nested)
// The deprecated flat fabrics[] array schema was removed - use components instead

// Helper to coerce string to number or null
const coerceToNumber = z
  .union([z.number(), z.string().transform((v) => (v === '' ? null : parseFloat(v))), z.null()])
  .optional()
  .nullable();

const coerceToInt = z
  .union([z.number().int(), z.string().transform((v) => (v === '' ? null : parseInt(v, 10))), z.null()])
  .optional()
  .nullable();

export const createStyleSchema = z.object({
  // Required fields
  styleCode: z
    .string()
    .min(2, 'Style code must be at least 2 characters')
    .max(50, 'Style code must not exceed 50 characters'),
  styleName: z
    .string()
    .min(2, 'Style name must be at least 2 characters')
    .max(200, 'Style name must not exceed 200 characters'),

  // Basic optional fields
  customerName: z.string().optional(),
  brandName: z.string().optional(),
  brandCategoryId: z.string().uuid().optional().nullable(),
  productCategoryId: z.string().uuid().optional().nullable(),
  category: z.string().optional(),
  description: z.string().optional().nullable(),
  season: z.string().optional(),
  // seasonId accepts CUID (season_master uses @default(cuid()))
  seasonId: z.string().refine(isValidIdFormat, { message: 'Invalid season ID' }).optional().nullable(),
  gender: GenderEnum.optional().nullable(),
  ageGroup: AgeGroupEnum.optional().nullable(),
  specifications: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  projectGroup: z.string().optional(),

  // Status fields
  status: StyleStatusEnum.optional(),
  cadStatus: CADStatusEnum.optional(),

  // Pricing fields - coerce strings to numbers
  costPrice: coerceToNumber,
  sellingPrice: coerceToNumber,

  // Additional fields - coerce strings to integers
  expectedOrderQuantity: coerceToInt,
  numberOfComponents: coerceToInt,
  hsnCode: z.string().optional().nullable(),
  productTaxRule: z.string().optional().nullable(),
  accountingSKU: z.string().optional().nullable(),
  accountingUnit: z.string().optional().nullable(),
  bulletPoints: z.string().optional().nullable(),

  // Nested arrays
  components: z.array(styleComponentSchema).optional().default([]),
  processes: z.array(styleProcessSchema).optional().default([]),
  materialBOM: z.array(materialBOMSchema).optional().default([]),
  customerAccessoriesPresetId: z.string().uuid().optional().nullable(),

  // Legacy arrays (deprecated but kept for backward compatibility)
  garmentTrims: z.array(garmentTrimSchema).optional().default([]),
  valueAdditions: z.array(valueAdditionSchema).optional().default([]),
  packagingTrims: z.array(packagingTrimSchema).optional().default([]),

  // SKU variants
  skuVariants: z.array(skuVariantSchema).optional().default([]),
  // NOTE: fabrics are sent via components[].fabrics[] (nested), not as standalone array

  // New simplified trims and accessories (phase 4)
  trims: z.array(styleTrimSchema).optional().default([]),
  accessories: z.array(materialBOMSchema).optional().default([]),
});

// ============================================================================
// UPDATE STYLE SCHEMA
// ============================================================================

export const updateStyleSchema = z.object({
  // All fields optional for updates
  styleName: z
    .string()
    .min(2, 'Style name must be at least 2 characters')
    .max(200, 'Style name must not exceed 200 characters')
    .optional(),
  customerName: z.string().optional(),
  brandName: z.string().optional(),
  brandCategoryId: z.string().uuid().optional().nullable(),
  productCategoryId: z.string().uuid().optional().nullable(),
  category: z.string().optional(),
  description: z.string().optional().nullable(),
  season: z.string().optional(),
  // seasonId accepts CUID (season_master uses @default(cuid()))
  seasonId: z.string().refine(isValidIdFormat, { message: 'Invalid season ID' }).optional().nullable(),
  gender: GenderEnum.optional().nullable(),
  ageGroup: AgeGroupEnum.optional().nullable(),
  specifications: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  projectGroup: z.string().optional(),

  // Status fields
  status: StyleStatusEnum.optional(),
  cadStatus: CADStatusEnum.optional(),

  // Pricing fields - coerce strings to numbers
  costPrice: coerceToNumber,
  sellingPrice: coerceToNumber,

  // Additional fields - coerce strings to integers
  expectedOrderQuantity: coerceToInt,
  numberOfComponents: coerceToInt,
  hsnCode: z.string().optional().nullable(),
  productTaxRule: z.string().optional().nullable(),
  accountingSKU: z.string().optional().nullable(),
  accountingUnit: z.string().optional().nullable(),
  bulletPoints: z.string().optional().nullable(),

  // Nested arrays - components and processes
  components: z.array(styleComponentSchema).optional(),
  processes: z.array(styleProcessSchema).optional(),
  materialBOM: z.array(materialBOMSchema).optional(),
  customerAccessoriesPresetId: z.string().uuid().optional().nullable(),

  // SKU variants
  skuVariants: z.array(skuVariantSchema).optional(),
  // NOTE: fabrics are sent via components[].fabrics[] (nested), not as standalone array

  // New simplified trims and accessories (phase 4)
  trims: z.array(styleTrimSchema).optional(),
  accessories: z.array(materialBOMSchema).optional(),
});

// ============================================================================
// QUERY SCHEMA (for GET /api/styles)
// ============================================================================

export const styleQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(1000, 'Limit cannot exceed 1000').optional().default(10),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  season: z.string().optional(),
  category: z.string().optional(),
  brandName: z.string().optional(),
  brandCategoryId: z.string().uuid().optional(),
  gender: GenderEnum.optional(),
  ageGroup: AgeGroupEnum.optional(),
  status: StyleStatusEnum.optional(),
  cadStatus: CADStatusEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  stage: z.string().optional(), // ProductionStage filter
  projectGroup: z.string().optional(),
});

// ============================================================================
// PARAM SCHEMAS
// ============================================================================

export const styleIdParamSchema = z.object({
  id: z.string().uuid('Invalid style ID format'),
});

export const styleIdAsStyleIdParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
});

export const componentIdParamSchema = z.object({
  componentId: z.string().uuid('Invalid component ID'),
});

export const styleAndBomIdParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  bomId: z.string().uuid('Invalid BOM ID'),
});

export const styleAndCommentIdParamSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  commentId: z.string().uuid('Invalid comment ID'),
});

export const costingIdParamSchema = z.object({
  costingId: z.string().uuid('Invalid costing ID'),
});

export const costingAndItemIdParamSchema = z.object({
  costingId: z.string().uuid('Invalid costing ID'),
  itemId: z.string().uuid('Invalid item ID'),
});

export const compareCostSheetsParamSchema = z.object({
  id1: z.string().uuid('Invalid cost sheet ID'),
  id2: z.string().uuid('Invalid cost sheet ID'),
});

// ============================================================================
// STYLE VARIANTS SCHEMA (for POST /api/styles/:id/variants)
// ============================================================================

export const createStyleVariantsSchema = z.object({
  variants: z.array(skuVariantSchema).min(1, 'At least one variant is required'),
});

// ============================================================================
// CAD PLANNING SCHEMAS
// ============================================================================

export const updateCADGroupingSchema = z.object({
  fabricGroups: z
    .array(
      z.object({
        fabricId: z.string().uuid(),
        cadGroupKey: z.string(),
      })
    )
    .min(1, 'At least one fabric group is required'),
});

export const approveCADPlanSchema = z.object({
  fabricCADMappings: z
    .array(
      z.object({
        fabricId: z.string().uuid(),
        fabricCADId: z.string().uuid(),
      })
    )
    .min(1, 'At least one fabric CAD mapping is required'),
});

// ============================================================================
// STANDALONE COMPONENT / FABRIC / ACCESSORY / PROCESS BODY SCHEMAS
// ============================================================================
// These validate the granular endpoints handled by styleComponent.controller.ts
// (POST /styles/:styleId/components, PUT /styles/components/:id, etc.).
// Field lists mirror exactly what the controller destructures from req.body —
// anything else is stripped, so keep them in sync when the controller changes.
// NOTE: distinct from the nested styleComponentSchema/styleFabricSchema above,
// which describe the arrays embedded in a create/update style payload.

// --- Components (style_components) ---

export const createComponentSchema = z.object({
  componentName: z.string().min(1, 'Component name is required'),
  componentType: z.string().min(1, 'Component type is required'),
  sortOrder: z.coerce.number().int().optional().nullable(),
});

export const updateComponentSchema = z.object({
  componentName: z.string().optional(),
  componentType: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

// --- Fabrics (style_fabrics) ---
// BUG-S2 fix: align with full style_fabrics table fields (was only 8 fields, now 22+)

export const createComponentFabricSchema = z.object({
  // Required fields
  fabricName: z.string().min(1, 'Fabric name is required'),
  fabricType: z.string().min(1, 'Fabric type is required'),
  // Optional basic fields
  fabricColor: z.string().optional().nullable(),
  fabricGSM: z.string().optional().nullable(), // stored as String in style_fabrics
  cadAverageMeters: z.coerce.number().nonnegative().optional().nullable(),
  cadAverageYards: z.coerce.number().nonnegative().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  unitPrice: z.coerce.number().nonnegative().optional().nullable(),
  // FK references
  fabricId: z.string().uuid().optional().nullable(),
  fabricCADId: z.string().uuid().optional().nullable(),
  embroideryId: z.string().refine(isValidIdFormat, { message: 'Invalid embroidery ID format' }).optional().nullable(),
  selectedGreigeId: z.string().uuid().optional().nullable(),
  colorMasterId: z
    .string()
    .refine(isValidIdFormat, { message: 'Invalid color master ID format' })
    .optional()
    .nullable(),
  // Fabric identification
  fabricFinishType: FabricFinishTypeEnum.optional().nullable(),
  greigeName: z.string().optional().nullable(),
  genericGreigeName: z.string().optional().nullable(),
  printDesign: z.string().optional().nullable(),
  // CAD & costing fields
  cadGroupKey: z.string().optional().nullable(),
  quantityNeeded: z.coerce.number().nonnegative().optional().nullable(),
  cutableWidth: z.coerce.number().nonnegative().optional().nullable(),
  fabricCostPerMeter: z.coerce.number().nonnegative().optional().nullable(),
  embroideryCostPerMeter: z.coerce.number().nonnegative().optional().nullable(),
  totalCostPerMeter: z.coerce.number().nonnegative().optional().nullable(),
  // Embroidery & cutting
  hasEmbroidery: z.boolean().optional().default(false),
  allowCombinedCutting: z.boolean().optional().default(true),
  numberOfColors: z.coerce.number().int().nonnegative().optional().nullable(),
  averagingMode: z.string().optional().nullable(),
  // Notes
  notes: z.string().optional().nullable(),
});

export const updateComponentFabricSchema = z.object({
  // All fields optional for updates
  fabricName: z.string().optional().nullable(),
  fabricType: z.string().optional().nullable(),
  fabricColor: z.string().optional().nullable(),
  fabricGSM: z.string().optional().nullable(),
  cadAverageMeters: z.coerce.number().nonnegative().optional().nullable(),
  cadAverageYards: z.coerce.number().nonnegative().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  unitPrice: z.coerce.number().nonnegative().optional().nullable(),
  // FK references
  fabricId: z.string().uuid().optional().nullable(),
  fabricCADId: z.string().uuid().optional().nullable(),
  embroideryId: z.string().refine(isValidIdFormat, { message: 'Invalid embroidery ID format' }).optional().nullable(),
  selectedGreigeId: z.string().uuid().optional().nullable(),
  colorMasterId: z
    .string()
    .refine(isValidIdFormat, { message: 'Invalid color master ID format' })
    .optional()
    .nullable(),
  // Fabric identification
  fabricFinishType: FabricFinishTypeEnum.optional().nullable(),
  greigeName: z.string().optional().nullable(),
  genericGreigeName: z.string().optional().nullable(),
  printDesign: z.string().optional().nullable(),
  // CAD & costing fields
  cadGroupKey: z.string().optional().nullable(),
  quantityNeeded: z.coerce.number().nonnegative().optional().nullable(),
  cutableWidth: z.coerce.number().nonnegative().optional().nullable(),
  fabricCostPerMeter: z.coerce.number().nonnegative().optional().nullable(),
  embroideryCostPerMeter: z.coerce.number().nonnegative().optional().nullable(),
  totalCostPerMeter: z.coerce.number().nonnegative().optional().nullable(),
  // Embroidery & cutting
  hasEmbroidery: z.boolean().optional(),
  allowCombinedCutting: z.boolean().optional(),
  numberOfColors: z.coerce.number().int().nonnegative().optional().nullable(),
  averagingMode: z.string().optional().nullable(),
  // Notes
  notes: z.string().optional().nullable(),
});

// --- Accessories (style_accessories) ---

export const createComponentAccessorySchema = z.object({
  accessoryName: z.string().min(1, 'Accessory name is required'),
  accessoryType: z.string().min(1, 'Accessory type is required'),
  quantityPerPiece: z.coerce.number().nonnegative(),
  unit: z.string().min(1, 'Unit is required'),
  supplierName: z.string().optional().nullable(),
  unitPrice: z.coerce.number().nonnegative().optional().nullable(),
});

export const updateComponentAccessorySchema = z.object({
  // accessoryName / accessoryType / quantityPerPiece / unit are NOT NULL in the DB,
  // so they may be omitted but never explicitly nulled.
  accessoryName: z.string().optional(),
  accessoryType: z.string().optional(),
  quantityPerPiece: z.coerce.number().nonnegative().optional(),
  unit: z.string().optional(),
  supplierName: z.string().optional().nullable(),
  unitPrice: z.coerce.number().nonnegative().optional().nullable(),
});

// --- Processes (style_processes) ---
// processType is a Prisma enum column; the controller falls back to processName
// when processType is omitted, so processType stays optional here.

export const createStyleProcessSchema = z.object({
  processName: z.string().min(1, 'Process name is required'),
  processType: ProcessTypeEnum.optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  estimatedCost: coerceAnyToNumber.optional(),
  estimatedDays: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateStyleProcessSchema = z.object({
  processName: z.string().optional(),
  processType: ProcessTypeEnum.optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  estimatedCost: coerceAnyToNumber.optional(),
  estimatedDays: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ============================================================================
// STYLE COMMENT SCHEMAS (routes in style-comment.routes.ts)
// ============================================================================

/**
 * Create Style Comment
 * POST /api/styles/:styleId/comments
 * styleId comes from the URL and userId from the authenticated user — neither is read from the body.
 * `.trim()` runs before `.min(1)` so a whitespace-only comment is rejected the same way the
 * controller's own guard rejects it (but with a clean 400 instead of a thrown ValidationError).
 */
export const createStyleCommentSchema = z.object({
  comment: z.string().trim().min(1, 'Comment text is required'),
  // Optional reply target; the UI sends `replyToId || undefined`. style_comments ids are UUIDs
  // (see styleAndCommentIdParamSchema above).
  parentId: z.string().uuid('Invalid parent comment ID').optional().nullable(),
});

/**
 * Update Style Comment
 * PATCH /api/styles/:styleId/comments/:commentId
 */
export const updateStyleCommentSchema = z.object({
  comment: z.string().trim().min(1, 'Comment text is required'),
});

// ============================================================================
// STYLE MATERIAL BOM SCHEMAS (routes in style-material-bom.routes.ts)
// ============================================================================

// Matches the Prisma MaterialUsageCategory enum exactly.
export const MaterialUsageCategoryEnum = z.enum(['GARMENT_TRIM', 'VALUE_ADDITION', 'PACKAGING']);

/**
 * Add Material to Style BOM
 * POST /api/styles/:styleId/materials
 * The controller resolves materialType/materialId/unitPrice/totalCost itself from `materialCode`'s
 * prefix (LACE-, BTN-, THR-, ZIP-, ELA-, LBL-, PKG-), so only these six fields come from the body.
 * quantityPerGarment is coerced because the controller feeds it to parseFloat() before writing it to
 * a Decimal(10,4) column — a non-numeric string produced NaN and 500'd in Prisma.
 */
export const addStyleMaterialBOMSchema = z.object({
  materialCode: z.string().trim().min(1, 'Material code is required').max(100),
  usageCategory: MaterialUsageCategoryEnum,
  componentName: z.string().max(200, 'Component name must not exceed 200 characters').trim().optional().nullable(),
  quantityPerGarment: z.coerce.number().positive('Quantity per garment must be positive'),
  unit: z.string().trim().min(1, 'Unit is required').max(50),
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').trim().optional().nullable(),
});

/**
 * Update Style BOM Item
 * PUT /api/styles/:styleId/materials/:bomId
 * All fields optional — the controller falls back to the existing row for anything left undefined.
 * materialCode/usageCategory are intentionally absent: the controller does not read them on update.
 */
export const updateStyleMaterialBOMSchema = z.object({
  componentName: z.string().max(200, 'Component name must not exceed 200 characters').trim().optional().nullable(),
  quantityPerGarment: z.coerce.number().positive('Quantity per garment must be positive').optional(),
  unit: z.string().trim().min(1, 'Unit must not be empty').max(50).optional(),
  notes: z.string().max(1000, 'Notes must not exceed 1000 characters').trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateStyleInput = z.infer<typeof createStyleSchema>;
export type UpdateStyleInput = z.infer<typeof updateStyleSchema>;
export type StyleQueryInput = z.infer<typeof styleQuerySchema>;
export type StyleIdParam = z.infer<typeof styleIdParamSchema>;
export type CreateStyleVariantsInput = z.infer<typeof createStyleVariantsSchema>;
export type UpdateCADGroupingInput = z.infer<typeof updateCADGroupingSchema>;
export type ApproveCADPlanInput = z.infer<typeof approveCADPlanSchema>;
export type CreateStyleCommentInput = z.infer<typeof createStyleCommentSchema>;
export type UpdateStyleCommentInput = z.infer<typeof updateStyleCommentSchema>;
export type AddStyleMaterialBOMInput = z.infer<typeof addStyleMaterialBOMSchema>;
export type UpdateStyleMaterialBOMInput = z.infer<typeof updateStyleMaterialBOMSchema>;
export type CreateComponentInput = z.infer<typeof createComponentSchema>;
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>;
export type CreateComponentFabricInput = z.infer<typeof createComponentFabricSchema>;
export type UpdateComponentFabricInput = z.infer<typeof updateComponentFabricSchema>;
export type CreateComponentAccessoryInput = z.infer<typeof createComponentAccessorySchema>;
export type UpdateComponentAccessoryInput = z.infer<typeof updateComponentAccessorySchema>;
export type CreateStyleProcessInput = z.infer<typeof createStyleProcessSchema>;
export type UpdateStyleProcessInput = z.infer<typeof updateStyleProcessSchema>;

// Individual type exports for nested schemas
export type StyleFabric = z.infer<typeof styleFabricSchema>;
export type StyleComponent = z.infer<typeof styleComponentSchema>;
export type StyleProcess = z.infer<typeof styleProcessSchema>;
export type MaterialBOM = z.infer<typeof materialBOMSchema>;
export type SKUVariant = z.infer<typeof skuVariantSchema>;
export type GarmentTrim = z.infer<typeof garmentTrimSchema>;
export type ValueAddition = z.infer<typeof valueAdditionSchema>;
export type PackagingTrim = z.infer<typeof packagingTrimSchema>;
