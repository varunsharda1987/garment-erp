// ============================================
// Dyeing Module Types
// ============================================

// Re-export common types from printing since they share the same backend models
export type { LabDipStatus, JobWorkStatus } from './printing.types';
export { LabDipStatusLabels, LabDipStatusColors, JobWorkStatusLabels, JobWorkStatusColors } from './printing.types';

// Re-export Process PO types from printing (shared models)
export type {
  ProcessPOStatus,
  ProcessPO,
  CreateProcessPORequest,
  ProcessPOListResponse,
  ProcessPOQueryParams,
} from './printing.types';
export { ProcessPOStatusLabels, ProcessPOStatusColors } from './printing.types';

// ============================================
// Dyeing-specific Lab Dip Types
// ============================================

export interface DyeLabDip {
  id: string;
  labDipNumber: string;
  processType: 'DYEING';
  styleId: string;
  fabricId: string;

  // For Dyeing
  targetColorId?: string;
  colorReference?: string; // Pantone code

  millId: string;

  submissionDate: string;
  expectedDate?: string;
  receivedDate?: string;

  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RESUBMIT';

  // Approval
  approvedById?: string;
  approvalDate?: string;
  approvedSampleNo?: string;
  rejectionReason?: string;
  colorMatchRating?: 'Excellent' | 'Good' | 'Acceptable' | 'Poor';

  remarks?: string;

  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Relations (expanded)
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
  };
  fabric?: {
    id: string;
    fabricCode: string;
    fabricName: string;
  };
  targetColor?: {
    id: string;
    colorName: string;
    colorCode: string;
  };
  mill?: {
    id: string;
    name: string;
    code: string;
  };
  approvedBy?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
  };
  jobWorkOrders?: DyeJob[];
}

export interface CreateDyeLabDipRequest {
  styleId: string;
  fabricId: string;
  targetColorId?: string;
  colorReference?: string;
  millId: string;
  submissionDate: string;
  expectedDate?: string;
  remarks?: string;
}

export interface UpdateDyeLabDipRequest extends Partial<CreateDyeLabDipRequest> {
  receivedDate?: string;
  approvedSampleNo?: string;
  rejectionReason?: string;
  colorMatchRating?: 'Excellent' | 'Good' | 'Acceptable' | 'Poor';
}

export interface ApproveDyeLabDipRequest {
  approvedSampleNo: string;
  colorMatchRating: 'Excellent' | 'Good' | 'Acceptable' | 'Poor';
  remarks?: string;
}

export interface RejectDyeLabDipRequest {
  rejectionReason: string;
  remarks?: string;
}

// ============================================
// Dye Job Types
// ============================================

export interface DyeJob {
  id: string;
  jobWorkNumber: string;
  processType: 'DYEING';

  labDipId: string;
  styleId: string;
  fabricId: string;
  millId: string;

  // Fabric Sent
  fabricStockLotId: string;
  fabricType: 'GREIGE' | 'RFD' | 'DYED' | 'FINISHED';
  reprocessReason?: string;

  qtySentMeters: number;
  sentWidthInches: number;
  sentDate?: string;
  challanNumber?: string;
  vehicleNumber?: string;

  expectedReturnDate?: string;
  expectedShrinkage?: number;
  agreedRatePerMeter: number;

  // Receipt
  qtyReceivedMeters?: number;
  receivedWidthInches?: number;
  receivedDate?: string;
  receivedChallan?: string;
  invoiceNumber?: string;

  // Calculated
  actualShrinkage?: number;
  widthVariance?: number;

  // Than/fold measurement (for "L" tracking)
  thanCount?: number;
  foldLengthCm?: number;
  calculatedActualMeters?: number;

  // Quality
  qualityGrade?: 'A' | 'B' | 'Reject';
  colorMatchStatus?: 'Match' | 'Slight Variation' | 'Mismatch';
  defectMeters?: number;
  defectType?: string;
  actualRate?: number;

  // Finished fabric (auto-created at sendToMill)
  finishedFabricId?: string;

  status:
    | 'LAB_DIP_PENDING'
    | 'LAB_DIP_SUBMITTED'
    | 'LAB_DIP_APPROVED'
    | 'READY_TO_SEND'
    | 'SENT_TO_MILL'
    | 'AT_MILL'
    | 'RECEIVED'
    | 'QUALITY_CHECKED'
    | 'STOCK_UPDATED';

  remarks?: string;

  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Relations (expanded)
  labDip?: DyeLabDip;
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
  };
  fabric?: {
    id: string;
    fabricCode: string;
    fabricName: string;
  };
  mill?: {
    id: string;
    name: string;
    code: string;
  };
  fabricStockLot?: {
    id: string;
    lotNumber: string;
    availableQty: number;
    purchaseCost: number;
  };
  finishedFabric?: {
    id: string;
    fabricCode: string;
    fabricName: string;
    actualWidth: number;
  };
  createdBy?: {
    id: string;
    name: string;
  };
}

export interface CreateDyeJobRequest {
  labDipId: string;
  fabricStockLotId: string;
  fabricType: 'GREIGE' | 'RFD' | 'DYED' | 'FINISHED';
  reprocessReason?: string;
  qtySentMeters: number;
  sentWidthInches: number;
  expectedReturnDate?: string;
  expectedShrinkage?: number;
  agreedRatePerMeter: number;
  remarks?: string;
}

export interface SendToMillRequest {
  sentDate: string;
  challanNumber: string;
  vehicleNumber?: string;
}

export interface ReceiveFromMillRequest {
  qtyReceivedMeters?: number;
  receivedWidthInches: number;
  receivedDate: string;
  receivedChallan?: string;
  invoiceNumber?: string;
  thanCount?: number;
  foldLengthCm?: number;
}

export interface QualityCheckRequest {
  qualityGrade: 'A' | 'B' | 'Reject';
  colorMatchStatus: 'Match' | 'Slight Variation' | 'Mismatch';
  defectMeters?: number;
  defectType?: string;
  actualRate?: number;
  remarks?: string;
}

// ============================================
// API Response Types
// ============================================

export interface DyeLabDipListResponse {
  data: DyeLabDip[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DyeLabDipResponse {
  data: DyeLabDip;
}

export interface DyeJobListResponse {
  data: DyeJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DyeJobResponse {
  data: DyeJob;
}

export interface DyeingSummary {
  total: number;
  labDipsPending: number;
  labDipsApproved: number;
  atMill: number;
  received: number;
  qualityChecked: number;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
}

// ============================================
// Query Parameters
// ============================================

export interface DyeLabDipQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RESUBMIT';
  styleId?: string;
  millId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface DyeJobQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  labDipId?: string;
  styleId?: string;
  millId?: string;
  fromDate?: string;
  toDate?: string;
}

// ============================================
// UI Helper Constants
// ============================================

export const ColorMatchRatingLabels: Record<string, string> = {
  Excellent: 'Excellent Match',
  Good: 'Good Match',
  Acceptable: 'Acceptable',
  Poor: 'Poor Match',
};

export const ColorMatchRatingColors: Record<string, string> = {
  Excellent: 'bg-success-muted text-success',
  Good: 'bg-info-muted text-info',
  Acceptable: 'bg-yellow-100 text-yellow-800',
  Poor: 'bg-destructive/10 text-destructive',
};

export const FabricTypeLabels: Record<string, string> = {
  GREIGE: 'Greige',
  RFD: 'RFD (Ready for Dyeing)',
  DYED: 'Dyed',
  FINISHED: 'Finished',
};
