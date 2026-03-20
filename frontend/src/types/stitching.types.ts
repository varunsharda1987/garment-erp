// ============================================
// Stitching Module Types
// ============================================

// ============================================
// Status Enums
// ============================================

export type StitchingIssueStatus =
  | 'PENDING_RECEIPT'
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED';

export const StitchingIssueStatusLabels: Record<StitchingIssueStatus, string> = {
  PENDING_RECEIPT: 'Pending Receipt',
  RECEIVED: 'Received',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export const StitchingIssueStatusColors: Record<StitchingIssueStatus, string> = {
  PENDING_RECEIPT: 'bg-gray-100 text-gray-800',
  RECEIVED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

// ============================================
// Stitching Issue Types
// ============================================

export interface StitchingIssueSKU {
  id: string;
  stitchingIssueId: string;
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

export interface StitchingIssueComponent {
  id: string;
  stitchingIssueId: string;
  componentId: string;
  component?: {
    id: string;
    componentName: string;
    componentType: string;
  };
}

export interface StitchingDailyOutput {
  id: string;
  stitchingIssueId: string;
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
  skuOutputs?: StitchingOutputSKU[];
}

export interface StitchingOutputSKU {
  id: string;
  dailyOutputId: string;
  colorId: string;
  sizeId: string;
  goodQty: number;
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

export interface StitchingIssue {
  id: string;
  issueNumber: string;
  workOrderId: string;

  issueDate: string;
  managerId: string;
  expectedCompletionDate?: string;

  status: StitchingIssueStatus;

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
  skuBreakdown?: StitchingIssueSKU[];
  dailyOutputs?: StitchingDailyOutput[];
  components?: StitchingIssueComponent[];
}

// ============================================
// Create/Update Request Types
// ============================================

export interface CreateStitchingIssueRequest {
  workOrderId: string;
  issueDate: string;
  managerId?: string;
  contractorId?: string;
  expectedCompletionDate?: string;
  remarks?: string;
  transferSlipIds?: string[];
  components?: string[]; // Component IDs
  skuBreakdown: {
    colorId: string | null;
    sizeId: string;
    availableQty?: number;
    issuedQty: number;
  }[];
}

export interface UpdateStitchingIssueRequest extends Partial<CreateStitchingIssueRequest> {
  status?: StitchingIssueStatus;
  startDate?: string;
  endDate?: string;
}

export interface RecordDailyOutputRequest {
  outputDate: string;
  componentId?: string;
  skuOutputs: {
    colorId: string;
    sizeId: string;
    goodQty: number;
    defectQty?: number;
  }[];
  remarks?: string;
}

export interface ReceiveFromCuttingRequest {
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

export interface StitchingIssueListResponse {
  data: StitchingIssue[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StitchingIssueResponse {
  data: StitchingIssue;
}

export interface StitchingSummary {
  total: number;
  pendingReceipt: number;
  received: number;
  inProgress: number;
  completed: number;
  totalIssued: number;
  totalCompleted: number;
  byManager: Array<{
    managerId: string;
    managerName: string;
    issueCount: number;
    totalPieces: number;
    completedPieces: number;
  }>;
}

// ============================================
// Style-Size Summary
// ============================================

export interface StyleSizeSummarySize {
  sizeId: string;
  sizeName: string;
  sortOrder: number;
  pending: number;
  inProgress: number;
  completed: number;
  total: number;
}

export interface StyleSizeSummaryItem {
  workOrderId: string;
  workOrderNumber: string;
  styleCode: string;
  styleName: string;
  customerName: string;
  orderNumber: string;
  daysInCutting: number;
  daysInStitching: number;
  daysPendingPush: number | null;
  sizes: StyleSizeSummarySize[];
  totalPending: number;
  totalInProgress: number;
  totalCompleted: number;
}

// ============================================
// Incoming Transfer Slip (from Cutting)
// ============================================

export interface IncomingTransferSlip {
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

// ============================================
// Query Parameters
// ============================================

export interface StitchingIssueQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: StitchingIssueStatus;
  workOrderId?: string;
  managerId?: string;
  fromDate?: string;
  toDate?: string;
}
