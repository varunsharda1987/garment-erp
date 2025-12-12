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

  millId: string;

  submissionDate: string;
  expectedDate?: string;
  receivedDate?: string;

  status: LabDipStatus;

  // Approval
  approvedById?: string;
  approvalDate?: string;
  approvedSampleNo?: string;
  rejectionReason?: string;
  colorMatchRating?: string;

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

  millId: string;
  submissionDate: string;
  expectedDate?: string;
  remarks?: string;
}

export interface UpdateLabDipRequest extends Partial<CreateLabDipRequest> {
  receivedDate?: string;
  status?: LabDipStatus;
  approvedSampleNo?: string;
  rejectionReason?: string;
  colorMatchRating?: string;
}

export interface ApproveLabDipRequest {
  approvedSampleNo: string;
  colorMatchRating?: string;
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

  // Quality
  qualityGrade?: 'A' | 'B' | 'Reject';
  colorMatchStatus?: 'Match' | 'Slight Variation' | 'Mismatch';
  defectMeters?: number;
  defectType?: string;
  actualRate?: number;

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
  millId: string;

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
  qtyReceivedMeters: number;
  receivedWidthInches: number;
  receivedDate: string;
  receivedChallan?: string;
  invoiceNumber?: string;
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
  millId?: string;
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
  millId?: string;
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
  PENDING: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
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
  LAB_DIP_PENDING: 'bg-gray-100 text-gray-800',
  LAB_DIP_SUBMITTED: 'bg-blue-100 text-blue-800',
  LAB_DIP_APPROVED: 'bg-green-100 text-green-800',
  READY_TO_SEND: 'bg-yellow-100 text-yellow-800',
  SENT_TO_MILL: 'bg-purple-100 text-purple-800',
  AT_MILL: 'bg-indigo-100 text-indigo-800',
  RECEIVED: 'bg-teal-100 text-teal-800',
  QUALITY_CHECKED: 'bg-emerald-100 text-emerald-800',
  STOCK_UPDATED: 'bg-green-100 text-green-800',
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
