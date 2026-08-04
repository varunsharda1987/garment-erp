// ============================================
// Printing Module Types
// ============================================

// Enums
export type LabDipStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RESUBMIT';

export type JobWorkStatus =
  | 'LAB_DIP_PENDING'
  | 'LAB_DIP_SUBMITTED'
  | 'LAB_DIP_APPROVED'
  | 'READY_TO_SEND'
  | 'SENT_TO_MILL'
  | 'AT_MILL'
  | 'RECEIVED'
  | 'QUALITY_CHECKED'
  | 'STOCK_UPDATED';

export type PrintMethod = 'SCREEN_MACHINE' | 'SCREEN_HAND' | 'ROTARY' | 'BLOCK';

export type PrintChemistry = 'PIGMENT' | 'PROCIAN' | 'DISCHARGE';

// ============================================
// Lab Dip Types
// ============================================

export interface LabDip {
  id: string;
  labDipNumber: string;
  processType: 'PRINTING' | 'DYEING';
  styleId: string;
  fabricId: string;

  // For Printing
  designArtwork?: string;
  printMethod?: PrintMethod;
  printChemistry?: PrintChemistry;

  // For Dyeing
  targetColorId?: string;
  colorReference?: string;

  processorId: string;

  submissionDate: string;
  expectedDate?: string;
  receivedDate?: string;

  status: LabDipStatus;

  // Approval
  approvedById?: string;
  approvalDate?: string;
  approvedSampleNo?: string;
  rejectionReason?: string;
  colorMatchRating?: 'Excellent' | 'Good' | 'Acceptable' | 'Poor';

  // Buyer Approval
  buyerApprovalStatus?: 'NOT_SENT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESUBMIT_REQUIRED';
  sentToBuyerDate?: string;
  buyerApprovalDate?: string;
  buyerRemarks?: string;

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
    finishType?: string | null;
    printDesign?: string | null;
    colorName?: string | null;
  };
  targetColor?: {
    id: string;
    colorName: string;
    colorCode: string;
  };
  processor?: {
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
  jobWorkOrders?: JobWorkOrder[];
}

export interface CreateLabDipRequest {
  processType: 'PRINTING' | 'DYEING';
  styleId: string;
  fabricId: string;

  // For Printing
  designArtwork?: string;
  printMethod?: PrintMethod;
  printChemistry?: PrintChemistry;

  // For Dyeing
  targetColorId?: string;
  colorReference?: string;

  processorId: string;
  submissionDate: string;
  expectedDate?: string;
  remarks?: string;
}

export interface UpdateLabDipRequest extends Partial<CreateLabDipRequest> {
  receivedDate?: string;
  status?: LabDipStatus;
  approvedSampleNo?: string;
  rejectionReason?: string;
  colorMatchRating?: 'Excellent' | 'Good' | 'Acceptable' | 'Poor';
}

export interface ApproveLabDipRequest {
  approvedSampleNo: string;
  colorMatchRating?: 'Excellent' | 'Good' | 'Acceptable' | 'Poor';
  remarks?: string;
}

export interface RejectLabDipRequest {
  rejectionReason: string;
  remarks?: string;
}

// ============================================
// Job Work Order Types (Print Job)
// ============================================

export interface JobWorkOrder {
  id: string;
  jobWorkNumber: string;
  processType: 'PRINTING' | 'DYEING';

  labDipId: string;
  styleId: string;
  fabricId: string;
  processorId: string;

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
  qcDate?: string;
  qcPassed?: boolean;
  qcRemarks?: string;
  approvedQty?: number;
  rejectedQty?: number;

  // Return
  returnedQty?: number;
  returnedDate?: string;
  returnReason?: string;

  // Finished fabric (auto-created at sendToMill)
  finishedFabricId?: string;

  status: JobWorkStatus;

  remarks?: string;

  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Relations (expanded)
  labDip?: LabDip;
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    buyerStyleRef?: string | null;
  };
  fabric?: {
    id: string;
    fabricCode: string;
    fabricName: string;
    finishType?: string | null;
    printDesign?: string | null;
    colorName?: string | null;
  };
  processor?: {
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

export interface CreateJobWorkOrderRequest {
  processType: 'PRINTING' | 'DYEING';
  labDipId: string;
  styleId: string;
  fabricId: string;
  processorId: string;

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

export interface LabDipListResponse {
  data: LabDip[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LabDipResponse {
  data: LabDip;
}

export interface JobWorkOrderListResponse {
  data: JobWorkOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JobWorkOrderResponse {
  data: JobWorkOrder;
}

export interface PrintingSummary {
  total: number;
  labDipsPending: number;
  labDipsApproved: number;
  atMill: number;
  received: number;
  qualityChecked: number;
  byStatus: Array<{
    status: JobWorkStatus;
    count: number;
  }>;
}

// ============================================
// Query Parameters
// ============================================

export interface LabDipQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  processType?: 'PRINTING' | 'DYEING';
  status?: LabDipStatus;
  styleId?: string;
  processorId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface JobWorkOrderQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  processType?: 'PRINTING' | 'DYEING';
  status?: JobWorkStatus;
  labDipId?: string;
  styleId?: string;
  processorId?: string;
  fromDate?: string;
  toDate?: string;
}

// ============================================
// UI Helper Constants
// ============================================

export const LabDipStatusLabels: Record<LabDipStatus, string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RESUBMIT: 'Resubmit Needed',
};

export const LabDipStatusColors: Record<LabDipStatus, string> = {
  PENDING: 'bg-muted text-foreground',
  SUBMITTED: 'bg-info-muted text-info',
  APPROVED: 'bg-success-muted text-success',
  REJECTED: 'bg-destructive/10 text-destructive',
  RESUBMIT: 'bg-yellow-100 text-yellow-800',
};

export const JobWorkStatusLabels: Record<JobWorkStatus, string> = {
  LAB_DIP_PENDING: 'Lab Dip Pending',
  LAB_DIP_SUBMITTED: 'Lab Dip Submitted',
  LAB_DIP_APPROVED: 'Lab Dip Approved',
  READY_TO_SEND: 'Ready to Send',
  SENT_TO_MILL: 'Sent to Mill',
  AT_MILL: 'At Mill',
  RECEIVED: 'Received',
  QUALITY_CHECKED: 'Quality Checked',
  STOCK_UPDATED: 'Stock Updated',
};

export const JobWorkStatusColors: Record<JobWorkStatus, string> = {
  LAB_DIP_PENDING: 'bg-muted text-foreground',
  LAB_DIP_SUBMITTED: 'bg-info-muted text-info',
  LAB_DIP_APPROVED: 'bg-success-muted text-success',
  READY_TO_SEND: 'bg-yellow-100 text-yellow-800',
  SENT_TO_MILL: 'bg-accent/10 text-accent',
  AT_MILL: 'bg-primary/10 text-primary',
  RECEIVED: 'bg-teal-100 text-teal-800',
  QUALITY_CHECKED: 'bg-emerald-100 text-emerald-800',
  STOCK_UPDATED: 'bg-success-muted text-success',
};

export const PrintMethodLabels: Record<PrintMethod, string> = {
  SCREEN_MACHINE: 'Screen Machine',
  SCREEN_HAND: 'Screen Hand',
  ROTARY: 'Rotary',
  BLOCK: 'Block',
};

export const PrintChemistryLabels: Record<PrintChemistry, string> = {
  PIGMENT: 'Pigment',
  PROCIAN: 'Procian',
  DISCHARGE: 'Discharge',
};

// BUG-DYE4 fix: colorMatchRating scale aligned with dyeing module
// Both modules now use the same 4-level scale: Excellent, Good, Acceptable, Poor
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

// ============================================
// Process PO Types
// ============================================

export type ProcessPOStatus =
  | 'DRAFT'
  | 'AT_MILL'
  | 'RECEIVED'
  | 'QUALITY_CHECKED'
  | 'STOCK_UPDATED'
  | 'RETURNED'
  | 'CANCELLED';

export interface ProcessPO {
  id: string;
  poNumber: string;
  poDate: string;
  expectedDeliveryDate: string;
  totalAmount: number | null;
  status: string;
  processPOStatus: ProcessPOStatus;
  agreedRatePerMeter?: number | null;
  remarks?: string;
  supplier?: { id: string; code: string; name: string };
  labDip?: { id: string; labDipNumber: string } | null;
  items?: Array<{
    id: string;
    serviceType: string | null;
    printingType: string | null;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  jobWorkOrder?: JobWorkOrder | null;
}

export interface CreateProcessPORequest {
  // Either labDipId OR (styleId + fabricId + processorId) must be provided
  labDipId?: string;
  // Style-based PO fields (when labDipId is not provided)
  styleId?: string;
  fabricId?: string;
  processorId?: string;
  // Common fields
  greigeStockLotId: string;
  qtySentMeters: number;
  sentWidthInches: number;
  agreedRatePerMeter: number;
  isRateTbd?: boolean; // True when rate=0 is intentional TBD
  expectedReturnDate?: string;
  expectedShrinkage?: number;
  fabricType?: string;
  remarks?: string;
  // Auto-send fields (Create & Send one-click)
  autoSend?: boolean; // If true, immediately send to mill after creation
  sentDate?: string;
  challanNumber?: string;
  vehicleNumber?: string;
}

export interface ProcessPOListResponse {
  data: ProcessPO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProcessPOQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProcessPOStatus;
  styleId?: string;
  processorId?: string;
  fromDate?: string;
  toDate?: string;
}

export const ProcessPOStatusLabels: Record<ProcessPOStatus, string> = {
  DRAFT: 'Draft',
  AT_MILL: 'At Mill',
  RECEIVED: 'Received',
  QUALITY_CHECKED: 'QC Done',
  STOCK_UPDATED: 'Stock Updated',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
};

export const ProcessPOStatusColors: Record<ProcessPOStatus, string> = {
  DRAFT: 'bg-muted text-foreground',
  AT_MILL: 'bg-info-muted text-info',
  RECEIVED: 'bg-accent/10 text-accent',
  QUALITY_CHECKED: 'bg-orange-100 text-orange-800',
  STOCK_UPDATED: 'bg-success-muted text-success',
  RETURNED: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-destructive/10 text-destructive',
};
