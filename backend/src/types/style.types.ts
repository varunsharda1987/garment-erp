/**
 * Style Types
 * Type definitions for style-related operations
 */

import { Prisma, MaterialType as PrismaMaterialType } from '@prisma/client';

// Re-export Prisma's MaterialType for use in controllers
export type MaterialType = PrismaMaterialType;

// ============================================
// Component Types
// ============================================

/**
 * Fabric data within a component
 */
export interface StyleFabricInput {
  fabricId?: string | null;
  fabricCADId?: string | null;
  fabricFinishType?: string | null;
  cadGroupKey?: string | null;
  fabricName?: string;
  fabricType?: string;
  greigeName?: string | null;
  genericGreigeName?: string | null;
  quantityNeeded?: number | string | null;
  unitPrice?: number | string | null;
  notes?: string | null;
  // Embroidery support
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  // Width tracking
  usableWidth?: number | string | null;
  // Cost tracking
  fabricCostPerMeter?: number | string | null;
  embroideryCostPerMeter?: number | string | null;
  totalCostPerMeter?: number | string | null;
  // CAD control
  allowCombinedCutting?: boolean;
}

/**
 * Component data with nested fabrics
 */
export interface StyleComponentInput {
  componentName: string;
  componentType?: string;
  fabrics?: StyleFabricInput[];
}

// ============================================
// Process Types
// ============================================

/**
 * Process/operation data
 */
export interface StyleProcessInput {
  processName?: string;
  processType?: string;
  isRequired?: boolean;
  supplierId?: string | null;
  estimatedCost?: number | string | null;
  estimatedDays?: number | null;
  notes?: string | null;
  description?: string | null; // Frontend sends 'description' instead of 'notes'
}

// ============================================
// Material BOM Types
// ============================================

// MaterialType is now re-exported from Prisma at the top of this file

/**
 * Usage category for materials
 */
export type UsageCategory = 'GARMENT_TRIM' | 'VALUE_ADDITION' | 'PACKAGING';

/**
 * Material BOM item input
 */
export interface MaterialBOMInput {
  materialType: MaterialType;
  materialId?: string | null;
  usageCategory?: UsageCategory;
  componentName?: string | null;
  quantityPerGarment?: number | string;
  unit?: string;
  unitPrice?: number | string | null;
  totalCost?: number | string | null;
  notes?: string | null;
}

/**
 * Simplified trim input for style creation (new system)
 * Only captures master reference - quantity/cost handled at order/costing level
 */
export type TrimType = 'BUTTON' | 'THREAD' | 'ZIPPER' | 'ELASTIC' | 'LACE' | 'LABEL';

export interface StyleTrimInput {
  trimType: TrimType;
  masterId: string;
  masterCode: string;
  masterName: string;
  color?: string | null;
}

// ============================================
// Legacy Types (Deprecated - for backward compatibility)
// ============================================

/**
 * @deprecated Use StyleProcessInput instead
 */
export interface ValueAdditionInput {
  additionType?: string;
  description?: string | null;
  type?: string | null;
  numberOfItems?: number | null;
}

/**
 * @deprecated Use MaterialBOMInput instead
 */
export interface PackagingTrimInput {
  itemName: string;
  itemType?: string;
  specification?: string | null;
  quantityPerPack?: number | string;
}

// ============================================
// SKU Variant Types
// ============================================

/**
 * SKU variant input for style creation
 */
export interface SKUVariantInput {
  size: string;
  sku: string;
  barcode?: string | null;
  accountingSKU?: string | null;
  isActive?: boolean;
}

// ============================================
// Flat Fabric Types (New System)
// ============================================

/**
 * Flat fabric structure (component-independent)
 */
export interface FlatFabricInput {
  componentName: string;
  genericGreigeName: string;
  fabricFinishType?: string | null;
  estimatedConsumption?: number | string;
  unit?: string;
  notes?: string | null;
  // Embroidery support
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  // Width tracking
  usableWidth?: number | string | null;
  // Cost tracking
  fabricCostPerMeter?: number | string | null;
  embroideryCostPerMeter?: number | string | null;
  // CAD control
  allowCombinedCutting?: boolean;
}

// ============================================
// Create Style Request
// ============================================

/**
 * Complete request body for creating a style
 */
export interface CreateStyleRequest {
  styleCode: string;
  styleName: string;
  customerName?: string;
  brandName?: string;
  brandCategoryId?: string | null;
  productCategoryId?: string | null;
  category?: string;
  description?: string;
  season?: string;
  seasonId?: string | null;
  gender?: string | null;
  components?: StyleComponentInput[];
  processes?: StyleProcessInput[];
  materialBOM?: MaterialBOMInput[];
  customerAccessoriesPresetId?: string;
  // Additional fields
  costPrice?: number | string | null;
  sellingPrice?: number | string | null;
  expectedOrderQuantity?: number | string | null;
  hsnCode?: string | null;
  productTaxRule?: string | null;
  accountingSKU?: string | null;
  accountingUnit?: string | null;
  bulletPoints?: string | null;
  specifications?: string | null;
  imageUrl?: string | null;
  skuVariants?: SKUVariantInput[];
  fabrics?: FlatFabricInput[];
  numberOfComponents?: number | string | null;
  // New simplified trims (phase 4)
  trims?: StyleTrimInput[];
  accessories?: MaterialBOMInput[]; // Packaging items only
  // Legacy fields (deprecated)
  valueAdditions?: ValueAdditionInput[];
  packagingTrims?: PackagingTrimInput[];
}

/**
 * Request body for updating a style
 */
export interface UpdateStyleRequest extends Partial<CreateStyleRequest> {
  // Update can be partial
}

// ============================================
// Query Options
// ============================================

/**
 * Query options for listing styles
 */
export interface StyleQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  stage?: string;
  customerName?: string;
  brandName?: string;
  season?: string;
  status?: string;
  cadStatus?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Accessory Preset Types
// ============================================

/**
 * Accessory item from customer preset
 */
export interface PresetAccessoryItem {
  materialType: MaterialType;
  materialId?: string;
  usageCategory?: UsageCategory;
  componentName?: string;
  quantityPerGarment?: number;
  unit?: string;
}

// ============================================
// Response Types
// ============================================

/**
 * Basic style info for list responses
 */
export interface StyleListItem {
  id: string;
  styleCode: string;
  styleName: string;
  customerName: string | null;
  brandName: string | null;
  season: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Error response structure
 */
export interface StyleErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

// ============================================
// CAD Planning Types
// ============================================

/**
 * Fabric group for CAD planning
 */
export interface FabricGroupInput {
  fabricId: string;
  cadGroupKey: string;
}

/**
 * Fabric to CAD mapping for approval
 */
export interface FabricCADMapping {
  fabricId: string;
  fabricCADId: string;
}
