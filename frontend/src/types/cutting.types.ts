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
  PENDING: 'bg-muted text-foreground',
  IN_PROGRESS: 'bg-info-muted text-info',
  COMPLETED: 'bg-success-muted text-success',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
};

// ============================================
// Cutting Batch Types
// ============================================

export interface CuttingBatchSKU {
  id: string;
  cuttingBatchId: string;
  colorId: string | null;
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
  colorId: string | null;
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

  // Status & Timestamps
  status: CuttingBatchStatus;
  startedAt?: string;
  completedAt?: string;

  // Calculated Fields (consumption & averages)
  actualAverage?: number;
  fabricIssued?: number;
  fabricReturned?: number;
  actualConsumption?: number;
  returnChallanId?: string;
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
      buyerStyleRef?: string | null;
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
      finishType?: string | null;
      printDesign?: string | null;
      colorName?: string | null;
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
  additionalFabrics?: Array<{
    id: string;
    fabricStockId: string;
    cadAvgUsed: number | null;
    cadWidthUsed: number | null;
    actualWidth: number | null;
    fabricConsumed?: number;
    fabricStock?: {
      id: string;
      rollNumbers?: string;
      quantityAvailable: number;
      fabricMaster?: {
        id: string;
        fabricCode: string;
        fabricName: string;
        finishType?: string | null;
        printDesign?: string | null;
        colorName?: string | null;
      };
    };
  }>;
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
    colorId: string | null;
    sizeId: string;
    plannedQty: number;
  }[];
  fabricStocks?: {
    fabricStockId: string;
    cadAvgUsed: number;
    cadWidthUsed: number;
    actualWidth: number;
  }[];
}

export interface UpdateCuttingBatchRequest extends Partial<CreateCuttingBatchRequest> {
  status?: CuttingBatchStatus;
  fabricConsumed?: number;
}

export interface RecordCuttingOutputRequest {
  skuOutputs: {
    id?: string;
    colorId: string | null;
    sizeId: string;
    cutQty: number;
    rejectedQty?: number;
  }[];
  defects?: {
    colorId: string | null;
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
  fabricReturns?: Array<{
    fabricStockId: string;
    returnedQuantity: number;
  }>;
}

// Issued fabric data for completion dialog
export interface IssuedFabricItem {
  fabricStockId: string;
  cuttingBatchFabricId: string;
  fabricName: string;
  fabricCode: string;
  rollNumbers: string;
  issuedQty: number;
  consumedInLays: number;
  balance: number;
}

// Style actual consumption (computed from cutting batches)
export interface StyleActualConsumption {
  componentId: string | null;
  componentName: string;
  fabricId: string | null;
  fabricName: string;
  fabricCode: string;
  cadAverage: number;
  actualAverage: number;
  variancePercent: number;
  totalConsumed: number;
  totalPiecesCut: number;
  workOrderCount: number;
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

  // Fabric Stock Analysis — per-fabric max cuttable pcs
  fabricAnalysis: CuttingFabricAnalysis[];
  maxCuttablePcs: number;
  bottleneckFabric: string | null;
  pendingCutQty: number;

  // Existing batches
  existingBatches: CuttingChartExistingBatch[];
}

export interface CuttingFabricAnalysis {
  part: string;
  fabricId: string | null;
  fabricName: string;
  cadAverage: number;
  cadSet: boolean;
  availableStock: number;
  maxPcsFromStock: number | null;
  requiredForOrder: number;
  shortfallMeters: number;
}

// ============================================
// Cutting Lay Types (Daily Production Input)
// ============================================

export interface CuttingLaySKU {
  id: string;
  cuttingLayId: string;
  colorId: string | null;
  sizeId: string;
  pieces: number;
  color?: { id: string; colorName: string };
  size?: { id: string; sizeName: string; sortOrder?: number };
}

export interface CuttingLayFabric {
  id: string;
  cuttingBatchFabricId: string;
  layerLength: number;
  batchFabric?: {
    id: string;
    fabricStockId: string;
    cadAvgUsed: number | null;
    fabricStock?: {
      id: string;
      rollNumbers?: string;
      fabricMaster?: {
        id: string;
        fabricCode: string;
        fabricName: string;
      };
    };
  };
}

export interface CuttingLay {
  id: string;
  cuttingBatchId: string;
  layDate: string;
  layNumber: number;
  layerLength: number;
  numberOfLayers: number;
  totalPieces: number;
  remarks?: string;
  cuttingBatchFabricId?: string;
  batchFabric?: {
    id: string;
    fabricStockId: string;
    cadAvgUsed: number | null;
    fabricStock?: {
      id: string;
      rollNumbers?: string;
      fabricMaster?: {
        id: string;
        fabricCode: string;
        fabricName: string;
      };
    };
  };
  layFabrics?: CuttingLayFabric[];
  createdBy?: { id: string; name: string };
  createdAt: string;
  skuOutputs: CuttingLaySKU[];
}

export interface AddCuttingLayRequest {
  layDate: string;
  numberOfLayers: number;
  remarks?: string;
  fabricLengths?: { cuttingBatchFabricId: string; layerLength: number }[];
  skuOutputs: { colorId: string | null; sizeId: string; piecesPerLayer: number }[];
  // Legacy fields
  layerLength?: number;
  cuttingBatchFabricId?: string;
}

// ============================================
// Issue to Stitching Types
// ============================================

export interface IssueToStitchingRequest {
  issuedToId: string;
  issueDate: string;
  remarks?: string;
  skuOutputs: { colorId: string | null; sizeId: string; quantity: number }[];
}

// ============================================
// Style-Size Summary (with Days Tracking)
// ============================================

export interface CuttingStyleSizeSummarySize {
  sizeId: string;
  sizeName: string;
  sortOrder: number;
  planned: number;
  cut: number;
  goodPcs: number;
  pending: number;
}

export interface CuttingStyleSizeSummaryItem {
  workOrderId: string;
  workOrderNumber: string;
  styleCode: string;
  styleName: string;
  buyerStyleRef?: string | null;
  customerName: string;
  orderNumber: string;
  daysInCutting: number;
  daysPendingPush: number | null;
  sizes: CuttingStyleSizeSummarySize[];
  totalPlanned: number;
  totalCut: number;
  totalGoodPcs: number;
}

export interface StitchingIssueSKUSummary {
  colorId: string | null;
  sizeId: string;
  colorName: string;
  sizeName: string;
  goodPcs: number;
  issuedQty: number;
  availableQty: number;
}

export interface StitchingIssueRecord {
  id: string;
  slipNumber: string;
  issueDate: string;
  issuedTo: { id: string; name: string };
  preparedBy?: { id: string; name: string } | null;
  totalPieces: number;
  status: string;
  remarks?: string;
  skuBreakdown: Array<{
    colorId: string | null;
    sizeId: string;
    colorName: string;
    sizeName: string;
    quantity: number;
  }>;
}

export interface StitchingIssueSummary {
  perSku: StitchingIssueSKUSummary[];
  issues: StitchingIssueRecord[];
}
