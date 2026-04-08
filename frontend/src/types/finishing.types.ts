// ============================================
// Finishing Module Types
// ============================================

// ============================================
// Status Enums
// ============================================

export type FinishingStatus = 'PENDING_RECEIPT' | 'RECEIVED' | 'IN_PROGRESS' | 'PACKING' | 'COMPLETED';

export const FinishingStatusLabels: Record<FinishingStatus, string> = {
  PENDING_RECEIPT: 'Pending Receipt',
  RECEIVED: 'Received',
  IN_PROGRESS: 'In Progress',
  PACKING: 'Packing',
  COMPLETED: 'Completed',
};

export const FinishingStatusColors: Record<FinishingStatus, string> = {
  PENDING_RECEIPT: 'bg-muted text-foreground',
  RECEIVED: 'bg-info-muted text-info',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  PACKING: 'bg-accent/10 text-accent',
  COMPLETED: 'bg-success-muted text-success',
};

// ============================================
// Finishing Issue Types
// ============================================

export interface FinishingIssueSKU {
  id: string;
  finishingIssueId: string;
  colorId: string;
  sizeId: string;
  availableQty: number;
  issuedQty: number;
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

export interface FinishingIssueComponent {
  id: string;
  finishingIssueId: string;
  componentId: string;
  component?: {
    id: string;
    componentName: string;
    componentType: string;
  };
}

export interface FinishingDailyOutput {
  id: string;
  finishingIssueId: string;
  componentId?: string;
  outputDate: string;
  remarks?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
  };
  skuOutputs?: FinishingOutputSKU[];
}

export interface FinishingOutputSKU {
  id: string;
  dailyOutputId: string;
  colorId: string;
  sizeId: string;
  finishedQty: number;
  defectQty: number;
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

export interface FinishingIssue {
  id: string;
  issueNumber: string;
  workOrderId: string;

  issueDate: string;
  managerId: string;
  expectedCompletionDate?: string;

  status: FinishingStatus;

  remarks?: string;

  // Timing
  startDate?: string;
  endDate?: string;

  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Relations (expanded)
  workOrder?: {
    id: string;
    workOrderNumber: string;
    styleId: string;
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
  manager?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
  };
  skuBreakdown?: FinishingIssueSKU[];
  dailyOutputs?: FinishingDailyOutput[];
  components?: FinishingIssueComponent[];
}

// ============================================
// Create/Update Request Types
// ============================================

export interface CreateFinishingIssueRequest {
  workOrderId: string;
  issueDate: string;
  managerId?: string;
  contractorId?: string;
  expectedCompletionDate?: string;
  remarks?: string;
  components?: string[]; // Component IDs
  skuBreakdown: {
    colorId: string | null;
    sizeId: string;
    availableQty?: number;
    issuedQty: number;
  }[];
}

export interface UpdateFinishingIssueRequest extends Partial<CreateFinishingIssueRequest> {
  status?: FinishingStatus;
  startDate?: string;
  endDate?: string;
}

export interface RecordDailyOutputRequest {
  outputDate: string;
  componentId?: string;
  skuOutputs: {
    colorId: string;
    sizeId: string;
    finishedQty: number;
    defectQty?: number;
  }[];
  remarks?: string;
}

export interface ReceiveFromStitchingRequest {
  transferSlipId: string;
  skuReceived: {
    colorId: string;
    sizeId: string;
    receivedQty: number;
    shortageQty?: number;
    excessQty?: number;
    remarks?: string;
  }[];
}

// ============================================
// API Response Types
// ============================================

export interface FinishingIssueListResponse {
  data: FinishingIssue[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FinishingIssueResponse {
  data: FinishingIssue;
}

export interface FinishingSummary {
  total: number;
  pendingReceipt: number;
  received: number;
  inProgress: number;
  packing: number;
  completed: number;
  totalIssued: number;
  totalFinished: number;
  byManager: Array<{
    managerId: string;
    managerName: string;
    issueCount: number;
    totalPieces: number;
    finishedPieces: number;
  }>;
}

// ============================================
// Query Parameters
// ============================================

export interface FinishingIssueQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: FinishingStatus;
  workOrderId?: string;
  managerId?: string;
  fromDate?: string;
  toDate?: string;
}

// ============================================
// Style-Size Summary (with Days Tracking)
// ============================================

export interface FinishingStyleSizeSummarySize {
  sizeId: string;
  sizeName: string;
  sortOrder: number;
  pending: number;
  inProgress: number;
  completed: number;
  total: number;
}

export interface FinishingStyleSizeSummaryItem {
  workOrderId: string;
  workOrderNumber: string;
  styleCode: string;
  styleName: string;
  customerName: string;
  orderNumber: string;
  daysInCutting: number;
  daysInStitching: number;
  daysInFinishing: number;
  daysPendingPush: number | null;
  sizes: FinishingStyleSizeSummarySize[];
  totalPending: number;
  totalInProgress: number;
  totalCompleted: number;
}

// ============================================
// Incoming Transfer Slip (from Stitching)
// ============================================

export interface FinishingIncomingTransferSlip {
  id: string;
  slipNumber: string;
  workOrderId: string;
  workOrderNumber: string;
  styleCode: string;
  styleName: string;
  totalGoodPieces: number;
  transferDate: string;
  issuedTo: string | null;
  skuBreakdown: Array<{
    colorId: string | null;
    colorName: string;
    sizeId: string;
    sizeName: string;
    sortOrder: number;
    quantity: number;
  }>;
}
