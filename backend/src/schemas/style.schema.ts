import { z } from 'zod';

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
  quantityNeeded: z.number().nonnegative().optional().nullable(),
  unitPrice: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Style Component Schema
export const styleComponentSchema = z.object({
  componentName: z.string().min(1, 'Component name is required'),
  componentType: z.string().optional().nullable(),
  fabrics: z.array(styleFabricSchema).optional().default([]),
});

// Style Process Schema
export const styleProcessSchema = z.object({
  processName: z.string().min(1, 'Process name is required'),
  processType: ProcessTypeEnum.optional(),
  isRequired: z.boolean().optional().default(true),
  vendorName: z.string().optional().nullable(),
  estimatedCost: z.number().nonnegative().optional().nullable(),
  estimatedDays: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Material BOM Schema
export const materialBOMSchema = z.object({
  materialType: z.string().min(1, 'Material type is required'),
  materialId: z.string().optional().nullable(),
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

// SKU Variant Schema
export const skuVariantSchema = z.object({
  size: z.string().min(1, 'Size is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional().nullable(),
  accountingSKU: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

// Flat Fabric Schema
export const flatFabricSchema = z.object({
  componentName: z.string().min(1, 'Component name is required'),
  genericFabricName: z.string().min(1, 'Generic fabric name is required'),
  fabricFinishType: FabricFinishTypeEnum.optional().nullable(),
  estimatedConsumption: z.number().nonnegative().optional().default(0),
  unit: z.string().optional().default('METER'),
  notes: z.string().optional().nullable(),
});

// ============================================================================
// CREATE STYLE SCHEMA
// ============================================================================

export const createStyleSchema = z.object({
  // Required fields
  styleCode: z.string().min(2, 'Style code must be at least 2 characters').max(50, 'Style code must not exceed 50 characters'),
  styleName: z.string().min(2, 'Style name must be at least 2 characters').max(200, 'Style name must not exceed 200 characters'),

  // Basic optional fields
  customerName: z.string().optional(),
  brandName: z.string().optional(),
  brandCategoryId: z.string().uuid().optional().nullable(),
  category: z.string().optional(),
  description: z.string().optional(),
  season: z.string().optional(),
  gender: GenderEnum.optional().nullable(),
  ageGroup: AgeGroupEnum.optional().nullable(),
  specifications: z.string().optional(),
  imageUrl: z.string().optional(),
  projectGroup: z.string().optional(),

  // Status fields
  status: StyleStatusEnum.optional(),
  cadStatus: CADStatusEnum.optional(),

  // Pricing fields
  costPrice: z.number().nonnegative('Cost price must be non-negative').optional().nullable(),
  sellingPrice: z.number().nonnegative('Selling price must be non-negative').optional().nullable(),

  // Additional fields
  expectedOrderQuantity: z.number().int().nonnegative().optional().nullable(),
  numberOfComponents: z.number().int().nonnegative().optional().nullable(),
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

  // SKU variants and fabrics
  skuVariants: z.array(skuVariantSchema).optional().default([]),
  fabrics: z.array(flatFabricSchema).optional().default([]),
});

// ============================================================================
// UPDATE STYLE SCHEMA
// ============================================================================

export const updateStyleSchema = z.object({
  // All fields optional for updates
  styleName: z.string().min(2, 'Style name must be at least 2 characters').max(200, 'Style name must not exceed 200 characters').optional(),
  customerName: z.string().optional(),
  brandName: z.string().optional(),
  brandCategoryId: z.string().uuid().optional().nullable(),
  category: z.string().optional(),
  description: z.string().optional(),
  season: z.string().optional(),
  gender: GenderEnum.optional().nullable(),
  ageGroup: AgeGroupEnum.optional().nullable(),
  specifications: z.string().optional(),
  imageUrl: z.string().optional(),
  projectGroup: z.string().optional(),

  // Status fields
  status: StyleStatusEnum.optional(),
  cadStatus: CADStatusEnum.optional(),

  // Pricing fields
  costPrice: z.number().nonnegative('Cost price must be non-negative').optional().nullable(),
  sellingPrice: z.number().nonnegative('Selling price must be non-negative').optional().nullable(),

  // Additional fields
  expectedOrderQuantity: z.number().int().nonnegative().optional().nullable(),
  numberOfComponents: z.number().int().nonnegative().optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  productTaxRule: z.string().optional().nullable(),
  accountingSKU: z.string().optional().nullable(),
  accountingUnit: z.string().optional().nullable(),
  bulletPoints: z.string().optional().nullable(),

  // SKU variants and fabrics
  skuVariants: z.array(skuVariantSchema).optional(),
  fabrics: z.array(flatFabricSchema).optional(),
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
  fabricGroups: z.array(
    z.object({
      fabricId: z.string().uuid(),
      cadGroupKey: z.string(),
    })
  ).min(1, 'At least one fabric group is required'),
});

export const approveCADPlanSchema = z.object({
  fabricCADMappings: z.array(
    z.object({
      fabricId: z.string().uuid(),
      fabricCADId: z.string().uuid(),
    })
  ).min(1, 'At least one fabric CAD mapping is required'),
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

// Individual type exports for nested schemas
export type StyleFabric = z.infer<typeof styleFabricSchema>;
export type StyleComponent = z.infer<typeof styleComponentSchema>;
export type StyleProcess = z.infer<typeof styleProcessSchema>;
export type MaterialBOM = z.infer<typeof materialBOMSchema>;
export type SKUVariant = z.infer<typeof skuVariantSchema>;
export type FlatFabric = z.infer<typeof flatFabricSchema>;
export type GarmentTrim = z.infer<typeof garmentTrimSchema>;
export type ValueAddition = z.infer<typeof valueAdditionSchema>;
export type PackagingTrim = z.infer<typeof packagingTrimSchema>;
