// Job Work Processing Types

// Enums
export const MaterialType = {
  GREIGE: 'GREIGE',
  FABRIC: 'FABRIC',
  LACE: 'LACE',
} as const;
export type MaterialType = typeof MaterialType[keyof typeof MaterialType];

export const ProcessingType = {
  DYEING: 'DYEING',
  PRINTING: 'PRINTING',
  EMBROIDERY: 'EMBROIDERY',
  WASHING: 'WASHING',
  FINISHING: 'FINISHING',
  CUTTING: 'CUTTING',
  STITCHING: 'STITCHING',
  OTHER: 'OTHER',
} as const;
export type ProcessingType = typeof ProcessingType[keyof typeof ProcessingType];

export const BatchStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type BatchStatus = typeof BatchStatus[keyof typeof BatchStatus];

export const StageStatus = {
  PENDING: 'PENDING',
  IN_TRANSIT_TO_PROCESSOR: 'IN_TRANSIT_TO_PROCESSOR',
  AT_PROCESSOR: 'AT_PROCESSOR',
  IN_PROCESS: 'IN_PROCESS',
  IN_TRANSIT_TO_COMPANY: 'IN_TRANSIT_TO_COMPANY',
  COMPLETED: 'COMPLETED',
  REWORK_REQUIRED: 'REWORK_REQUIRED',
} as const;
export type StageStatus = typeof StageStatus[keyof typeof StageStatus];

export const ProcessingMovementType = {
  WAREHOUSE_TO_PROCESSOR: 'WAREHOUSE_TO_PROCESSOR',
  PROCESSOR_TO_WAREHOUSE: 'PROCESSOR_TO_WAREHOUSE',
  PROCESSOR_TO_PROCESSOR: 'PROCESSOR_TO_PROCESSOR',
  REWORK_TO_PROCESSOR: 'REWORK_TO_PROCESSOR',
} as const;
export type ProcessingMovementType = typeof ProcessingMovementType[keyof typeof ProcessingMovementType];

export const MovementStatus = {
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
} as const;
export type MovementStatus = typeof MovementStatus[keyof typeof MovementStatus];

export const QualityStatus = {
  PENDING_QC: 'PENDING_QC',
  QC_PASSED: 'QC_PASSED',
  QC_FAILED: 'QC_FAILED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  REWORK_REQUIRED: 'REWORK_REQUIRED',
} as const;
export type QualityStatus = typeof QualityStatus[keyof typeof QualityStatus];

// Processing Batch Types
export interface ProcessingBatch {
  id: string;
  batchNumber: string;
  materialType: MaterialType;
  greigeId?: string;
  fabricId?: string;
  laceId?: string; // For lace processing
  totalQuantitySent: number;
  totalQuantityReceived: number;
  quantityInProcess: number;
  quantityInTransit: number;
  quantityRejected: number;
  overallStatus: BatchStatus;
  totalCostIncurred: number;
  createdById: string;
  createdAt: Date | string;
  updatedAt: Date | string;

  // Lace-specific fields
  colorToApply?: string;
  expectedShrinkagePercent?: number;
  dyeLotNumber?: string;
  shadeNote?: string;
  finishedLaceId?: string;

  // Relations
  greigeMaster?: {
    id: string;
    greigeCode: string;
    greigeName: string;
  };
  fabricMaster?: {
    id: string;
    fabricCode: string;
    fabricName: string;
  };
  laceMaster?: {
    id: string;
    laceCode: string;
    laceName: string;
    width?: number;
    composition?: string;
    isGreige?: boolean;
    expectedShrinkagePercent?: number;
    costPerMeterGreige?: number;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  stages?: ProcessingStage[];
  movements?: ProcessingMovement[];
  deliveries?: ProcessingDelivery[];
  _count?: {
    stages: number;
    movements: number;
    deliveries: number;
  };
}

export interface CreateProcessingBatchDTO {
  materialType: MaterialType;
  greigeId?: string;
  fabricId?: string;
  laceId?: string; // For lace processing
  totalQuantitySent: number;
  quantityInProcess: number;
  // Lace-specific fields
  colorToApply?: string;
  expectedShrinkagePercent?: number;
}

export interface UpdateProcessingBatchDTO {
  totalQuantityReceived?: number;
  quantityInProcess?: number;
  quantityInTransit?: number;
  quantityRejected?: number;
  overallStatus?: BatchStatus;
  totalCostIncurred?: number;
  // Lace-specific fields
  dyeLotNumber?: string;
  shadeNote?: string;
  finishedLaceId?: string;
}

export interface ProcessingBatchFilters {
  overallStatus?: BatchStatus;
  materialType?: MaterialType;
  greigeId?: string;
  fabricId?: string;
  laceId?: string; // For filtering lace processing batches
  search?: string;
}

// Receive processed lace input
export interface ReceiveProcessedLaceDTO {
  actualQuantityReceived: number;
  dyeLotNumber: string;
  shadeNote?: string;
  qualityGrade?: string;
  warehouseLocation?: string;
  rackNumber?: string;
  finishedLaceId?: string;
  originStyleId?: string;
  originOrderId?: string;
  originStyleCode?: string;
}

// Receive processed lace response
export interface ReceiveProcessedLaceResponse {
  batch: ProcessingBatch;
  stock: {
    id: string;
    laceId: string;
    quantityAvailable: number;
    weightedAvgCost: number;
    dyeLotNumber: string;
  };
  actualShrinkagePercent: number;
  expectedShrinkagePercent: number;
  shrinkageVariance: number;
  finishedCostPerMeter: number;
}

// Lace processing summary
export interface LaceProcessingSummary {
  totalBatches: number;
  totalQuantityInProcess: number;
  totalQuantityInTransit: number;
  batches: ProcessingBatch[];
}

export interface JobWorkSummary {
  totalBatches: number;
  totalQuantityInProcess: number;
  totalQuantityInTransit: number;
  totalCost: number;
}

// Processing Stage Types
export interface ProcessingStage {
  id: string;
  batchId: string;
  stageNumber: number;
  processorId: string;
  processorFacility?: string;
  processingType: ProcessingType;
  quantitySent: number;
  quantityReceived: number;
  quantityInProcess: number;
  processSpecifications?: string;
  expectedOutputSpecs?: any;
  actualOutputSpecs?: any;
  status: StageStatus;
  sentDate?: Date | string;
  expectedCompletionDate?: Date | string;
  actualCompletionDate?: Date | string;
  processingCost: number;
  qualityNotes?: string;
  reworkReason?: string;
  createdAt: Date | string;
  updatedAt: Date | string;

  // Relations
  batch?: {
    id: string;
    batchNumber: string;
    materialType: MaterialType;
  };
  processor?: {
    id: string;
    code: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
  };
  movements?: ProcessingMovement[];
  deliveries?: ProcessingDelivery[];
  _count?: {
    movements: number;
    deliveries: number;
  };
}

export interface CreateProcessingStageDTO {
  batchId: string;
  stageNumber: number;
  processorId: string;
  processorFacility?: string;
  processingType: ProcessingType;
  quantitySent: number;
  quantityInProcess: number;
  processSpecifications?: string;
  expectedOutputSpecs?: any;
  processingCost: number;
  sentDate?: Date | string;
  expectedCompletionDate?: Date | string;
}

export interface UpdateProcessingStageDTO {
  quantityReceived?: number;
  quantityInProcess?: number;
  actualOutputSpecs?: any;
  status?: StageStatus;
  actualCompletionDate?: Date | string;
  processingCost?: number;
  qualityNotes?: string;
  reworkReason?: string;
}

export interface ProcessingStageFilters {
  batchId?: string;
  processorId?: string;
  status?: StageStatus;
  processingType?: ProcessingType;
}

export interface ProcessorSummary {
  totalStages: number;
  totalQuantity: number;
  totalCost: number;
  byType: Record<string, {
    quantity: number;
    cost: number;
    count: number;
  }>;
}

// Processing Movement Types
export interface ProcessingMovement {
  id: string;
  batchId: string;
  stageId?: string;
  movementType: ProcessingMovementType;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  status: MovementStatus;
  vehicleNumber?: string;
  driverName?: string;
  lrNumber?: string;
  dispatchDate: Date | string;
  expectedDeliveryDate?: Date | string;
  actualDeliveryDate?: Date | string;
  challanNumber?: string;
  documents?: any;
  performedById: string;
  createdAt: Date | string;
  updatedAt: Date | string;

  // Relations
  batch?: {
    id: string;
    batchNumber: string;
    materialType: MaterialType;
  };
  stage?: {
    id: string;
    stageNumber: number;
    processingType: ProcessingType;
    processor?: {
      id: string;
      code: string;
      name: string;
    };
  };
  performedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

export interface CreateProcessingMovementDTO {
  batchId: string;
  stageId?: string;
  movementType: ProcessingMovementType;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  vehicleNumber?: string;
  driverName?: string;
  lrNumber?: string;
  dispatchDate: Date | string;
  expectedDeliveryDate?: Date | string;
  challanNumber?: string;
  documents?: any;
}

export interface UpdateProcessingMovementDTO {
  status?: MovementStatus;
  actualDeliveryDate?: Date | string;
  vehicleNumber?: string;
  driverName?: string;
  lrNumber?: string;
  challanNumber?: string;
  documents?: any;
}

export interface ProcessingMovementFilters {
  batchId?: string;
  stageId?: string;
  status?: MovementStatus;
  movementType?: ProcessingMovementType;
  startDate?: string;
  endDate?: string;
}

export interface TransitSummary {
  totalMovements: number;
  totalQuantity: number;
  delayedCount: number;
  maxDaysInTransit: number;
  byType: Record<string, {
    quantity: number;
    count: number;
  }>;
}

// Processing Delivery Types
export interface ProcessingDelivery {
  id: string;
  batchId: string;
  stageId: string;
  deliveryNumber: string;
  quantityDelivered: number;
  quantityAccepted: number;
  quantityRejected: number;
  qualityStatus: QualityStatus;
  qualityNotes?: string;
  rejectionReason?: string;
  receivedAtWarehouse?: string;
  nextStageId?: string;
  deliveryDate: Date | string;
  qcDate?: Date | string;
  acceptanceDate?: Date | string;
  invoiceNumber?: string;
  challanNumber?: string;
  documents?: any;
  receivedById: string;
  createdAt: Date | string;
  updatedAt: Date | string;

  // Relations
  batch?: {
    id: string;
    batchNumber: string;
    materialType: MaterialType;
  };
  stage?: {
    id: string;
    stageNumber: number;
    processingType: ProcessingType;
    processor?: {
      id: string;
      code: string;
      name: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
    };
  };
  receivedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

export interface CreateProcessingDeliveryDTO {
  batchId: string;
  stageId: string;
  quantityDelivered: number;
  deliveryDate: Date | string;
  receivedAtWarehouse?: string;
  nextStageId?: string;
  challanNumber?: string;
  invoiceNumber?: string;
  documents?: any;
}

export interface UpdateProcessingDeliveryDTO {
  quantityAccepted?: number;
  quantityRejected?: number;
  qualityStatus?: QualityStatus;
  qualityNotes?: string;
  rejectionReason?: string;
  qcDate?: Date | string;
  acceptanceDate?: Date | string;
}

export interface ProcessingDeliveryFilters {
  batchId?: string;
  stageId?: string;
  qualityStatus?: QualityStatus;
  startDate?: string;
  endDate?: string;
}

export interface PerformQCDTO {
  quantityAccepted: number;
  quantityRejected: number;
  qualityStatus: QualityStatus;
  qualityNotes?: string;
  rejectionReason?: string;
}

export interface DeliverySummary {
  totalDeliveries: number;
  totalDelivered: number;
  totalAccepted: number;
  totalRejected: number;
  rejectionRate: number;
  byStatus: Record<string, {
    count: number;
    quantity: number;
  }>;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
}
