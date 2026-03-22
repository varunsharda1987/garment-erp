// Style Import Types
// Types for bulk style import functionality

import { Gender } from '@prisma/client';

// =====================================================
// CSV Import Row Structure (New Simplified Format)
// =====================================================

/**
 * New simplified CSV import format - one row per size variant
 * Required fields: styleCode, customerName, brandName, size
 * Optional fields: styleName, season, gender, buyerCategory, buyerSubCategory, buyerSubSubCategory, internalCategory
 */
export interface StyleImportCSVRow {
  // Required Fields
  styleCode: string; // Unique style identifier (includes colorway, e.g., COS009, COS009B)
  customerName: string; // Customer/Buyer name - must exist in customers master
  brandName: string; // Brand name - will lookup/create in brand_categories
  size: string; // Size for this variant (S, M, L, XL, 4Y, etc.)

  // Optional Style Information
  styleName?: string; // Display name (defaults to styleCode if not provided)
  season?: string; // Season identifier (e.g., "Summer 2025")
  gender?: string; // MEN, WOMEN, KIDS, UNISEX (defaults to UNISEX)

  // Optional Category Information (Buyer-specific, 3-level hierarchy)
  buyerCategory?: string; // Buyer's category (e.g., "Ethnic Wear")
  buyerSubCategory?: string; // Buyer's sub-category (e.g., "Kurta Sets")
  buyerSubSubCategory?: string; // Buyer's sub-sub-category (e.g., "Full Sleeve")

  // Optional Internal Category
  internalCategory?: string; // Internal category name (global, flat structure)

  // Legacy fields (kept for backwards compatibility)
  status?: string;
  sku?: string;
  color?: string;
  category?: string;
  productName?: string;
  itemDescription?: string;
  bulletPoints?: string;
  projectGroup?: string;
  customer?: string; // Alias for customerName
  brand?: string; // Alias for brandName
  componentName?: string;
  greigeName?: string;
  fabricDescription?: string;
  cadAverage?: number | string;
  lastProductionAverage?: number | string;
  fabricWidth?: number | string;
  dyeing?: string;
  dyeingColor?: string;
  dyeingVendor?: string;
  printing?: string;
  printingDetails?: string;
  printingVendor?: string;
  embroidery?: string;
  embroideryDetails?: string;
  embroideryVendor?: string;
  washing?: string;
  washType?: string;
  washingVendor?: string;
  imageURL?: string;
  cost?: number | string;
  mrp?: number | string;
  accountingSKU?: string;
  accountingUnit?: string;
  productTaxRule?: string;
  hsnCode?: string;
  createdDate?: string;
  lastUpdatedDate?: string;
  materialType?: string;
}

// =====================================================
// Processed Import Data (New Format)
// =====================================================

export interface StyleImportRow {
  // Required fields (from CSV)
  styleCode: string;
  customerName: string;
  brandName: string;
  size: string;

  // Optional fields (from CSV)
  styleName?: string;
  season?: string;
  gender?: Gender;
  buyerCategory?: string;
  buyerSubCategory?: string;
  buyerSubSubCategory?: string;
  internalCategory?: string;

  // Resolved master IDs (populated during processing)
  customerId?: string;
  brandCategoryId?: string;
  internalCategoryId?: string;

  // Auto-generated fields
  sku?: string; // Generated: {styleCode}{size}
  barcode?: string; // Same as SKU

  // Legacy fields (kept for backwards compatibility)
  projectGroup?: string;
  itemDescription?: string;
  customer?: string;
  category?: string;
  componentName?: string;
  fabricDescription?: string;
  cadAverage?: number;
  lastProductionAverage?: number;
  fabricWidth?: number;
  generatedFabricCode?: string;
  generatedFabricName?: string;

  // Validation status
  isValid: boolean;
  validationErrors: string[];
}

// =====================================================
// Master Lookup Result Types
// =====================================================

export interface CustomerLookupResult {
  id: string;
  code: string;
  name: string;
}

export interface BrandCategoryLookupResult {
  id: string;
  customerId: string;
  brandName: string;
  category: string | null;
  subCategory: string | null;
  subSubCategory: string | null;
}

export interface StyleCategoryLookupResult {
  id: string;
  name: string;
}

// =====================================================
// Import Request/Response Types
// =====================================================

export interface StyleImportRequest {
  importBatchId: string;
  rows: StyleImportCSVRow[];
  overwriteExisting?: boolean; // If true, update existing styles
  skipDuplicates?: boolean; // If true, skip rows with duplicate style codes
}

export interface StyleImportResponse {
  success: boolean;
  importBatchId: string;
  summary: ImportSummary;
  errors?: StyleImportError[];
}

export interface ImportSummary {
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;

  stylesCreated: number;
  stylesUpdated: number;
  variantsCreated: number;

  // Legacy fields (kept for backwards compatibility, always 0 in simplified import)
  componentsCreated: number;
  fabricsCreated: number;
  cadEntriesCreated: number;

  processingTimeMs: number;
}

export interface StyleImportError {
  rowNumber: number;
  styleCode: string;
  componentName: string;
  fabricDescription: string;
  errorMessage: string;
  errorType: 'VALIDATION' | 'DATABASE' | 'BUSINESS_LOGIC';
}

// =====================================================
// Fabric Generation Types
// =====================================================

export interface FabricToCreate {
  fabricCode: string;
  fabricName: string;
  fabricDescription: string;
  styleReference: string;
  componentType: string;
  greigeId?: string; // If greige is specified/found
  actualWidth?: number;
  cadData?: FabricCADData;
}

export interface FabricCADData {
  availableWidth: number;
  cadMeters?: number;
  actualCad?: number; // Last production average
  cadVariancePercent?: number;
  cadWastagePercent?: number;
}

// =====================================================
// Style Data Structure
// =====================================================

export interface StyleToCreate {
  styleCode: string;
  styleName: string; // from itemDescription
  customerName?: string; // from customer
  projectGroup?: string;
  brandName?: string;
  season?: string;
  gender?: Gender;
  categoryId?: string;
  description?: string;
  createdById: string;
}

export interface ComponentToCreate {
  componentName: string;
  componentType: string; // Derived from componentName
  componentOrder: number;
  description?: string;
}

// =====================================================
// Import Status & Progress
// =====================================================

export interface ImportStatus {
  importBatchId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: ImportProgress;
  startedAt: Date;
  completedAt?: Date;
  errors?: StyleImportError[];
}

export interface ImportProgress {
  currentStep: string;
  currentRow: number;
  totalRows: number;
  percentComplete: number;
  estimatedTimeRemainingMs?: number;
}

// =====================================================
// Query Types
// =====================================================

export interface StyleFabricsQuery {
  styleId: string;
  includeCAD?: boolean;
  includeStock?: boolean;
}

export interface StyleFabricsResponse {
  styleCode: string;
  styleName: string;
  customerName?: string;
  season?: string;
  components: ComponentWithFabrics[];
}

export interface ComponentWithFabrics {
  componentName: string;
  componentType: string;
  fabrics: FabricWithCADAndStock[];
}

export interface FabricWithCADAndStock {
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  fabricDescription?: string;

  // CAD Data
  cadData?: {
    width: number;
    cadMeters?: number;
    actualCad?: number;
    cadVariancePercent?: number;
  }[];

  // Stock Data
  stockData?: {
    totalAvailable: number;
    totalReserved: number;
    totalConsumed: number;
    unit: string;
  };
}

// =====================================================
// Validation Rules
// =====================================================

export interface ValidationRule {
  field: string;
  rule: 'REQUIRED' | 'UNIQUE' | 'FORMAT' | 'RANGE' | 'REFERENCE';
  message: string;
  validate: (value: unknown, context?: Record<string, unknown>) => boolean;
}

export const STYLE_IMPORT_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'styleCode',
    rule: 'REQUIRED',
    message: 'Style code is required',
    validate: (value: unknown) => {
      if (!value) return false;
      if (typeof value !== 'string') return false;
      return value.trim().length > 0;
    },
  },
  {
    field: 'customerName',
    rule: 'REQUIRED',
    message: 'Customer name is required (must exist in customers master)',
    validate: (value: unknown, context?: Record<string, unknown>) => {
      // Check customerName or legacy customer field
      const customerValue = value || (context?.customer as unknown);
      if (!customerValue) return false;
      if (typeof customerValue !== 'string') return false;
      return customerValue.trim().length > 0;
    },
  },
  {
    field: 'brandName',
    rule: 'REQUIRED',
    message: 'Brand name is required',
    validate: (value: unknown, context?: Record<string, unknown>) => {
      // Check brandName or legacy brand field
      const brandValue = value || (context?.brand as unknown);
      if (!brandValue) return false;
      if (typeof brandValue !== 'string') return false;
      return brandValue.trim().length > 0;
    },
  },
  {
    field: 'size',
    rule: 'REQUIRED',
    message: 'Size is required for each variant row',
    validate: (value: unknown) => {
      if (!value) return false;
      if (typeof value !== 'string') return false;
      return value.trim().length > 0;
    },
  },
  {
    field: 'gender',
    rule: 'FORMAT',
    message: 'Gender must be one of: MALE/MEN, FEMALE/WOMEN, UNISEX, KIDS',
    validate: (value: unknown) => {
      if (!value) return true; // Optional field - defaults to UNISEX
      if (typeof value !== 'string') return false;
      const upper = value.toUpperCase();
      return ['MALE', 'MEN', 'FEMALE', 'WOMEN', 'UNISEX', 'KIDS'].includes(upper);
    },
  },
  // Legacy field validations (kept for backwards compatibility)
  {
    field: 'cadAverage',
    rule: 'RANGE',
    message: 'CAD average must be a positive number',
    validate: (value: unknown) => {
      if (!value) return true; // Optional field
      const num = typeof value === 'string' ? parseFloat(value) : Number(value);
      return !isNaN(num) && num > 0;
    },
  },
  {
    field: 'fabricWidth',
    rule: 'RANGE',
    message: 'Fabric width must be a positive number',
    validate: (value: unknown) => {
      if (!value) return true; // Optional field
      const num = typeof value === 'string' ? parseFloat(value) : Number(value);
      return !isNaN(num) && num > 0 && num <= 300; // Max 300 inches
    },
  },
];

// =====================================================
// Helper Types
// =====================================================

export type ImportStageStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ERROR';

export interface ImportStage {
  stage: string;
  status: ImportStageStatus;
  message?: string;
  startTime?: Date;
  endTime?: Date;
}
