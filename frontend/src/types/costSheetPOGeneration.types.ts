/**
 * Cost Sheet PO Generation Types
 * Frontend type definitions for generating Purchase Orders from approved Cost Sheets
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

export type POCategory = (typeof POCategory)[keyof typeof POCategory];

export const GenerationStatus = {
  GENERATED: 'GENERATED',
  PARTIALLY_ORDERED: 'PARTIALLY_ORDERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type GenerationStatus = (typeof GenerationStatus)[keyof typeof GenerationStatus];

// ============================================
// MATERIAL REQUIREMENT TYPES
// ============================================

export interface MaterialRequirement {
  materialId: string;
  materialCode: string;
  materialName: string;
  materialType: string;
  consumptionPerUnit: number;
  unit: string;
  requiredQty: number;
  availableStock: number;
  shortfall: number;
  unitPrice: number;
  supplierId?: string;
  supplierName?: string;
  sourcingStrategy?: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
  fabricWidth?: number;
  processorId?: string;
  processingCostPerMeter?: number;
}

export interface OrderQuantityResult {
  materialId: string;
  materialName: string;
  unit: string;
  requiredQty: number;
  availableStock: number;
  shortfall: number;
  allowancePercent: number;
  allowanceQty: number;
  orderQty: number;
  unitPrice: number;
  totalAmount: number;
  supplierId?: string;
}

export interface CalculatedRequirements {
  fabricItems: MaterialRequirement[];
  greigeItems: MaterialRequirement[];
  trimsItems: MaterialRequirement[];
  processingItems: MaterialRequirement[];
  fabricOrderQtys: OrderQuantityResult[];
  greigeOrderQtys: OrderQuantityResult[];
  trimsOrderQtys: OrderQuantityResult[];
  totalOrderQty: number;
  costSheetId: string;
  styleId: string;
  styleCode: string;
}

// ============================================
// GENERATED PO TYPES
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

export interface POGenerationStatus {
  generationId: string;
  costSheetId: string;
  totalOrderQty: number;
  generatedAt: string;
  generatedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  status: GenerationStatus;
  fabricPOId?: string;
  greigePOId?: string;
  processingPOId?: string;
  trimsPOId?: string;
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    poCategory: POCategory;
    status: string;
    totalAmount: number;
    supplierName: string;
    linkedGreigePOId?: string;
  }>;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface GeneratePOItem {
  materialId: string;
  orderQty: number;
  unit: string;
  unitPrice: number;
  allowancePercent: number;
  remarks?: string;
  materialType?: string;
  processType?: string;
  greigeMaterialId?: string;
}

export interface GenerateFabricPORequest {
  costSheetId: string;
  totalOrderQty: number;
  supplierId: string;
  items: GeneratePOItem[];
  notes?: string;
}

export interface GenerateGreigePORequest {
  costSheetId: string;
  totalOrderQty: number;
  supplierId: string;
  items: GeneratePOItem[];
  notes?: string;
}

export interface GenerateProcessingPORequest {
  costSheetId: string;
  totalOrderQty: number;
  processorId: string;
  items: GeneratePOItem[];
  linkedGreigePOId?: string;
  notes?: string;
}

export interface GenerateTrimsPORequest {
  costSheetId: string;
  totalOrderQty: number;
  supplierId: string;
  items: GeneratePOItem[];
  notes?: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface CalculateRequirementsResponse {
  success: boolean;
  data: CalculatedRequirements;
  message?: string;
}

export interface GeneratePOResponse {
  success: boolean;
  data: GeneratedPO;
  message?: string;
}

export interface GenerationStatusResponse {
  success: boolean;
  data: POGenerationStatus[];
  message?: string;
}

// ============================================
// FORM STATE TYPES
// ============================================

export interface POGenerationFormItem extends OrderQuantityResult {
  selected: boolean;
  adjustedAllowancePercent: number;
  adjustedOrderQty: number;
}

export type POType = 'FABRIC' | 'GREIGE';
