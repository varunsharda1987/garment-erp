/**
 * Cost Sheet PO Generation Types
 * Types for generating Purchase Orders from approved Cost Sheets
 */

// ============================================
// ENUMS
// ============================================

export const POCategory = {
  FABRIC: 'FABRIC',
  GREIGE: 'GREIGE',
  PROCESSING: 'PROCESSING',
  TRIMS: 'TRIMS',
  GENERAL: 'GENERAL',
} as const;

export type POCategory = typeof POCategory[keyof typeof POCategory];

export const GenerationStatus = {
  GENERATED: 'GENERATED',
  PARTIALLY_ORDERED: 'PARTIALLY_ORDERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type GenerationStatus = typeof GenerationStatus[keyof typeof GenerationStatus];

// Size-independent trim material types that can be ordered before size breakdown
export const SIZE_INDEPENDENT_TRIM_TYPES = [
  'THREAD',
  'BUTTON',
  'LABEL', // Brand/Care labels, not SIZE_LABEL
  'PACKAGING',
  'ZIPPER',
  'ELASTIC',
  'HOOK_EYE',
  'SNAP_BUTTON',
  'BUCKLE',
  'VELCRO',
  'INTERLINING',
  'DRAWSTRING',
  'LACE',
  'RIBBON',
  'BEAD',
  'SEQUIN',
  'MOTIF',
] as const;

// Size-dependent trims that require size breakdown
export const SIZE_DEPENDENT_TRIM_TYPES = [
  'SIZE_LABEL',
] as const;

// ============================================
// MATERIAL REQUIREMENT TYPES
// ============================================

export interface MaterialRequirement {
  materialId: string;
  materialCode: string;
  materialName: string;
  materialType: string;
  consumptionPerUnit: number;  // Per garment piece
  unit: string;
  requiredQty: number;        // totalOrderQty * consumptionPerUnit
  availableStock: number;     // Current in-house stock
  shortfall: number;          // max(0, requiredQty - availableStock)
  unitPrice: number;          // From cost sheet
  supplierId?: string;        // Preferred supplier
  supplierName?: string;

  // Fabric-specific fields
  sourcingStrategy?: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
  fabricWidth?: number;
  processorId?: string;
  processingCostPerMeter?: number;
}

export interface CalculatedRequirements {
  fabricItems: MaterialRequirement[];
  greigeItems: MaterialRequirement[];
  trimsItems: MaterialRequirement[];
  processingItems: MaterialRequirement[];
  totalOrderQty: number;
  costSheetId: string;
  styleId: string;
  styleCode: string;
}

// ============================================
// ORDER QUANTITY CALCULATION
// ============================================

export interface OrderQuantityInput {
  requirement: MaterialRequirement;
  allowancePercent: number;  // 0-5% buffer
}

export interface OrderQuantityResult {
  materialId: string;
  materialName: string;
  unit: string;
  requiredQty: number;
  availableStock: number;
  shortfall: number;
  allowancePercent: number;
  allowanceQty: number;      // shortfall * allowancePercent / 100
  orderQty: number;          // shortfall + allowanceQty
  unitPrice: number;
  totalAmount: number;       // orderQty * unitPrice
  supplierId?: string;
}

// ============================================
// PO GENERATION INPUT TYPES
// ============================================

export interface GeneratePOBaseInput {
  costSheetId: string;
  totalOrderQty: number;
  userId: string;
  defaultAllowancePercent?: number;  // Default 3%
  notes?: string;
}

export interface GenerateFabricPOInput extends GeneratePOBaseInput {
  supplierId: string;
  items: Array<{
    materialId: string;
    orderQty: number;
    unit: string;
    unitPrice: number;
    allowancePercent: number;
    remarks?: string;
  }>;
}

export interface GenerateGreigePOInput extends GeneratePOBaseInput {
  supplierId: string;
  items: Array<{
    materialId: string;     // Greige material ID
    orderQty: number;
    unit: string;
    unitPrice: number;      // Greige cost
    allowancePercent: number;
    remarks?: string;
  }>;
}

export interface GenerateProcessingPOInput extends GeneratePOBaseInput {
  processorId: string;      // Processor/Dyer supplier ID
  linkedGreigePOId?: string; // If Greige PO already exists
  items: Array<{
    materialId: string;     // Fabric material ID (output)
    greigeMaterialId: string;
    processType: string;    // DYEING, PRINTING, etc.
    orderQty: number;
    unit: string;
    unitPrice: number;      // Processing cost per unit
    allowancePercent: number;
    remarks?: string;
  }>;
}

export interface GenerateTrimsPOInput extends GeneratePOBaseInput {
  supplierId: string;
  items: Array<{
    materialId: string;
    materialType: string;
    orderQty: number;
    unit: string;
    unitPrice: number;
    allowancePercent: number;
    remarks?: string;
  }>;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface GeneratedPO {
  id: string;
  poNumber: string;
  poCategory: POCategory;
  status: string;
  supplierId: string;
  supplierName: string;
  totalAmount: number;
  itemCount: number;
  linkedGreigePOId?: string;
}

export interface CostSheetPOGenerationResult {
  generationId: string;
  costSheetId: string;
  totalOrderQty: number;
  generatedAt: Date;
  fabricPO?: GeneratedPO;
  greigePO?: GeneratedPO;
  processingPO?: GeneratedPO;
  trimsPO?: GeneratedPO;
  status: GenerationStatus;
}

// ============================================
// CALCULATION REQUEST/RESPONSE
// ============================================

export interface CalculateRequirementsRequest {
  costSheetId: string;
  totalOrderQty: number;
}

export interface CalculateRequirementsResponse {
  success: boolean;
  data: CalculatedRequirements;
  message?: string;
}

// ============================================
// GENERATION STATUS
// ============================================

export interface POGenerationStatus {
  generationId: string;
  costSheetId: string;
  totalOrderQty: number;
  generatedAt: Date;
  generatedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  status: GenerationStatus;
  fabricPO?: {
    id: string;
    poNumber: string;
    status: string;
    totalAmount: number;
  };
  greigePO?: {
    id: string;
    poNumber: string;
    status: string;
    totalAmount: number;
  };
  processingPO?: {
    id: string;
    poNumber: string;
    status: string;
    totalAmount: number;
    linkedGreigePOId?: string;
  };
  trimsPO?: {
    id: string;
    poNumber: string;
    status: string;
    totalAmount: number;
  };
}

// ============================================
// STOCK INFO
// ============================================

export interface StockInfo {
  materialId: string;
  available: number;
  reserved: number;
  total: number;
  unit: string;
  lastUpdated?: Date;
}
