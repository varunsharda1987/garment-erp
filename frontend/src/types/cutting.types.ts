// ============================================
// Cutting Module Types
// ============================================

// ============================================
// Status Enums
// ============================================

export type CuttingBatchStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';

export const CuttingBatchStatusLabels: Record<CuttingBatchStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
};

export const CuttingBatchStatusColors: Record<CuttingBatchStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
};

// ============================================
// Cutting Batch Types
// ============================================

export interface CuttingBatchSKU {
  id: string;
  cuttingBatchId: string;
  colorId: string;
  sizeId: string;
  orderQty: number;
  extraAllowed: number;
  maxCuttable: number;
  toCut: number;
  cutQty: number;
  rejectedQty: number;
  goodPcs: number;
  color?: {
    id: string;
    colorName: string;
    colorCode: string;
  };
  size?: {
    id: string;
    sizeName: string;
    sortOrder: number;
  };
}

export interface CuttingBatchDefect {
  id: string;
  cuttingBatchId: string;
  colorId: string;
  sizeId: string;
  defectType: string;
  defectQty: number;
  remarks?: string;
}

export interface CuttingBatch {
  id: string;
  batchNumber: string;
  workOrderId: string;
  componentId?: string;

  // Cutting Details
  cuttingDate: string;
  fabricStockId: string;
  actualFabricWidth: number;
  cadAverageUsed: number;
  cadWidthUsed: number;
  layersPerLay: number;
  numberOfLays: number;
  fabricConsumed: number;

  // Equipment & Staff
  cuttingTableId?: string;
  cuttingOperatorId?: string;

  // Status
  status: CuttingBatchStatus;

  // Calculated Fields
  actualAverage?: number;
  varianceFromCad?: number;
  variancePercent?: number;
  wastageMeters?: number;
  wastagePercent?: number;

  remarks?: string;

  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Relations (expanded)
  workOrder?: {
    id: string;
    workOrderNumber: string;
    styleId: string;
    orderId?: string;
    style?: {
      id: string;
      styleCode: string;
      styleName: string;
    };
    order?: {
      id: string;
      orderNumber: string;
      customer?: {
        id: string;
        name: string;
      };
    };
  };
  component?: {
    id: string;
    componentName: string;
    componentCode: string;
  };
  fabricStock?: {
    id: string;
    rollNumbers?: string;
    quantityAvailable: number;
    finishedWidth: number;
    cutableWidth: number;
    fabric?: {
      id: string;
      fabricCode: string;
      fabricName: string;
    };
  };
  cuttingOperator?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
  };
  skuOutputs?: CuttingBatchSKU[];
  defects?: CuttingBatchDefect[];
}

// ============================================
// Create/Update Request Types
// ============================================

export interface CreateCuttingBatchRequest {
  workOrderId: string;
  componentId?: string;
  cuttingDate: string;
  fabricStockId: string;
  actualFabricWidth: number;
  cadAverageUsed: number;
  cadWidthUsed?: number;
  layersPerLay: number;
  numberOfLays: number;
  cuttingTableId?: string;
  cuttingOperatorId?: string;
  remarks?: string;
  skuOutputs: {
    colorId: string;
    sizeId: string;
    plannedQty: number;
  }[];
}

export interface UpdateCuttingBatchRequest extends Partial<CreateCuttingBatchRequest> {
  status?: CuttingBatchStatus;
  fabricConsumed?: number;
}

export interface RecordCuttingOutputRequest {
  skuOutputs: {
    id?: string;
    colorId: string;
    sizeId: string;
    cutQty: number;
    rejectedQty?: number;
  }[];
  defects?: {
    colorId: string;
    sizeId: string;
    defectType: string;
    defectQty: number;
    remarks?: string;
  }[];
  fabricConsumed: number;
  remarks?: string;
}

export interface CompleteCuttingBatchRequest {
  actualAverage?: number;
  remarks?: string;
}

// ============================================
// API Response Types
// ============================================

export interface CuttingBatchListResponse {
  data: CuttingBatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CuttingBatchResponse {
  data: CuttingBatch;
}

export interface CuttingSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  onHold: number;
  totalPcsPlanned: number;
  totalPcsCut: number;
  totalFabricConsumed: number;
  byWorkOrder: Array<{
    workOrderId: string;
    workOrderNumber: string;
    styleName: string;
    batchCount: number;
    totalPlanned: number;
    totalCut: number;
  }>;
}

// ============================================
// Query Parameters
// ============================================

export interface CuttingBatchQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CuttingBatchStatus;
  workOrderId?: string;
  componentId?: string;
  fromDate?: string;
  toDate?: string;
}

// ============================================
// UI Helper Constants
// ============================================

export const DefectTypeLabels: Record<string, string> = {
  SHADE_VARIATION: 'Shade Variation',
  FABRIC_DEFECT: 'Fabric Defect',
  CUTTING_ERROR: 'Cutting Error',
  SIZE_WRONG: 'Wrong Size',
  PATTERN_MISMATCH: 'Pattern Mismatch',
  OTHER: 'Other',
};

export const DefectTypes = [
  'SHADE_VARIATION',
  'FABRIC_DEFECT',
  'CUTTING_ERROR',
  'SIZE_WRONG',
  'PATTERN_MISMATCH',
  'OTHER',
] as const;

// ============================================
// Cutting Chart Data Types
// ============================================

export interface CuttingChartSize {
  sizeId: string;
  sizeName: string;
  sortOrder: number;
  orderQty: number;
  completedQty: number;
  ratio: number;
}

export interface CuttingChartFabricDetail {
  part: string;
  fabric: string;
  fabricId: string | null;
  fabricOrdered: number;
  fabricReceived: number;
  cutableQty: number;
  extraShortage: number;
}

export interface CuttingChartLot {
  lotId: string;
  lotNumber: number;
  rollNumbers: string;
  actualWidth: number;
  quantityAvailable: number;
  qualityGrade: string;
}

export interface CuttingChartFabric {
  part: string;
  fabricId: string | null;
  fabricName: string;
  fabricCode: string;
  fabricColor: string | null;
  costingWidth: number | null;
  costingAverage: number | null;
  rawMatCalcWidth: number | null;
  rawMatCalcAverage: number | null;
  productionWidth: number | null;
  productionAverage: number | null;
  lots: CuttingChartLot[];
}

export interface CuttingChartExistingBatch {
  id: string;
  batchNumber: string;
  status: string;
  totalCut: number;
}

export interface CuttingChartData {
  // Header
  buyer: string;
  brand: string;
  style: string;
  styleName: string;
  styleImage: string;
  workOrderNumber: string;
  workOrderId: string;
  orderQty: number;
  color: string;
  colorId: string | null;
  cuttingDate: string;

  // Available colors
  availableColors: Array<{
    id: string;
    colorName: string;
    colorCode: string;
  }>;

  // Size breakdown
  sizes: CuttingChartSize[];
  totalOrderQty: number;

  // Fabric details
  fabricDetails: CuttingChartFabricDetail[];

  // Fabrics & CAD with lots
  fabrics: CuttingChartFabric[];

  // Existing batches
  existingBatches: CuttingChartExistingBatch[];
}
