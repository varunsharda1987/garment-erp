// Style Import Types
// Types for bulk style import functionality

import { Gender } from '@prisma/client';

// =====================================================
// CSV Import Row Structure
// =====================================================

export interface StyleImportCSVRow {
  // Status and Identification
  status?: string;
  styleCode: string;
  sku?: string;
  size?: string;
  color?: string;

  // Product Information
  category?: string;
  productName?: string;
  itemDescription: string;
  bulletPoints?: string;
  projectGroup?: string; // Project grouping for styles

  // Business Information
  customer?: string;
  brand?: string;
  season?: string;
  gender?: string;

  // Component and Fabric Details
  componentName: string;
  fabricDescription: string;
  cadAverage?: number | string;
  lastProductionAverage?: number | string;
  fabricWidth?: number | string;

  // Financial Information
  imageURL?: string;
  cost?: number | string;
  mrp?: number | string;

  // Accounting Information
  accountingSKU?: string;
  accountingUnit?: string;
  productTaxRule?: string;
  hsnCode?: string;

  // Metadata
  createdDate?: string;
  lastUpdatedDate?: string;
  materialType?: string;
}

// =====================================================
// Processed Import Data
// =====================================================

export interface StyleImportRow {
  // Original CSV data
  styleCode: string;
  projectGroup?: string;
  itemDescription: string;
  customer?: string;
  season?: string;
  gender?: Gender;
  category?: string;
  componentName: string;
  fabricDescription: string;
  cadAverage?: number;
  lastProductionAverage?: number;
  fabricWidth?: number;

  // Generated data
  generatedFabricCode?: string;
  generatedFabricName?: string;

  // Validation status
  isValid: boolean;
  validationErrors: string[];
}

// =====================================================
// Import Request/Response Types
// =====================================================

export interface StyleImportRequest {
  importBatchId: string;
  rows: StyleImportCSVRow[];
  overwriteExisting?: boolean;  // If true, update existing styles
  skipDuplicates?: boolean;     // If true, skip rows with duplicate style codes
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
  greigeId?: string;  // If greige is specified/found
  actualWidth?: number;
  cadData?: FabricCADData;
}

export interface FabricCADData {
  availableWidth: number;
  cadMeters?: number;
  actualCad?: number;  // Last production average
  cadVariancePercent?: number;
  cadWastagePercent?: number;
}

// =====================================================
// Style Data Structure
// =====================================================

export interface StyleToCreate {
  styleCode: string;
  styleName: string;  // from itemDescription
  buyerName?: string; // from customer
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
  componentType: string;  // Derived from componentName
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
  buyerName?: string;
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
  validate: (value: any, context?: any) => boolean;
}

export const STYLE_IMPORT_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'styleCode',
    rule: 'REQUIRED',
    message: 'Style code is required',
    validate: (value) => !!value && value.trim().length > 0,
  },
  {
    field: 'itemDescription',
    rule: 'REQUIRED',
    message: 'Item description is required',
    validate: (value) => !!value && value.trim().length > 0,
  },
  {
    field: 'componentName',
    rule: 'REQUIRED',
    message: 'Component name is required',
    validate: (value) => !!value && value.trim().length > 0,
  },
  {
    field: 'fabricDescription',
    rule: 'REQUIRED',
    message: 'Fabric description is required',
    validate: (value) => !!value && value.trim().length > 0,
  },
  {
    field: 'cadAverage',
    rule: 'RANGE',
    message: 'CAD average must be a positive number',
    validate: (value) => {
      if (!value) return true; // Optional field
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return !isNaN(num) && num > 0;
    },
  },
  {
    field: 'fabricWidth',
    rule: 'RANGE',
    message: 'Fabric width must be a positive number',
    validate: (value) => {
      if (!value) return true; // Optional field
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return !isNaN(num) && num > 0 && num <= 300; // Max 300 inches
    },
  },
  {
    field: 'gender',
    rule: 'FORMAT',
    message: 'Gender must be one of: MALE/MEN, FEMALE/WOMEN, UNISEX, KIDS',
    validate: (value) => {
      if (!value) return true; // Optional field
      if (typeof value !== 'string') return false;
      const upper = value.toUpperCase();
      return ['MALE', 'MEN', 'FEMALE', 'WOMEN', 'UNISEX', 'KIDS'].includes(upper);
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
