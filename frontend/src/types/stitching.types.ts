// ============================================
// Stitching Module Types
// ============================================

// ============================================
// Status Enums
// ============================================

export type StitchingIssueStatus = 'PENDING_RECEIPT' | 'RECEIVED' | 'IN_PROGRESS' | 'COMPLETED';

export const StitchingIssueStatusLabels: Record<StitchingIssueStatus, string> = {
  PENDING_RECEIPT: 'Pending Receipt',
  RECEIVED: 'Received',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

// Same colours as the page's summary cards (Received amber, In Progress blue)
export const StitchingIssueStatusColors: Record<StitchingIssueStatus, string> = {
  PENDING_RECEIPT: 'bg-muted text-foreground',
  RECEIVED: 'bg-warning-muted text-warning',
  IN_PROGRESS: 'bg-info-muted text-info',
  COMPLETED: 'bg-success-muted text-success',
};

// ============================================
// Stitching Issue Types
// ============================================

export interface StitchingIssueSKU {
  id: string;
  stitchingIssueId: string;
  colorId: string | null;
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
  colorId: string | null;
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
      /** The garment photo (styles.imageUrl) — the list includes the whole style. */
      imageUrl?: string | null;
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
  manager?: {
    id: string;
    name: string;
  };
  contractor?: {
    id: string;
    code: string;
    name: string;
    contactPerson?: string | null;
    phone?: string | null;
  } | null;
  createdBy?: {
    id: string;
    name: string;
  };
  skuBreakdown?: StitchingIssueSKU[];
  dailyOutputs?: StitchingDailyOutput[];
  components?: StitchingIssueComponent[];
  /** The slip that sent this issue's pieces on to finishing — null until one is generated */
  transferSlip?: {
    id: string;
    slipNumber: string;
    status: string;
  } | null;
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

// Exactly what PUT /stitching/issues/:id takes (updateStitchingIssueSchema); status and dates of
// the workflow change only through its actions
export interface UpdateStitchingIssueRequest {
  managerId?: string | null;
  contractorId?: string | null;
  remarks?: string;
  issueDate?: string;
  /** null clears it */
  expectedCompletionDate?: string | null;
}

export interface RecordDailyOutputRequest {
  outputDate: string;
  componentId?: string;
  skuOutputs: {
    colorId: string | null;
    sizeId: string;
    goodQty: number;
    defectQty?: number;
  }[];
  remarks?: string;
}

export interface CompleteStitchingIssueRequest {
  /** Required when fewer pieces are recorded than were issued; kept on the issue's remarks */
  shortReason?: string;
}

export interface ReceiveFromCuttingRequest {
  // Optional: omit rather than send '' — the backend guards on `if (transferSlipId)` and '' fails uuid validation.
  transferSlipId?: string;
  // Optional: the list-page quick-receive omits this; the detail page sends the received breakdown.
  skuReceived?: {
    colorId: string | null;
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
  /** Cut, on open cutting slips, not yet issued to a contractor */
  waiting: number;
  /** Issued to contractors */
  issued: number;
  /** Issued and not yet recorded, on issues not yet completed */
  withContractor: number;
  /** Good pieces recorded */
  stitched: number;
  /** Defect pieces recorded */
  defects: number;
}

export interface StyleSizeSummaryItem {
  workOrderId: string;
  workOrderNumber: string;
  styleCode: string;
  styleName: string;
  buyerStyleRef?: string | null;
  customerName: string;
  orderNumber: string;
  daysInCutting: number;
  daysInStitching: number;
  daysPendingPush: number | null;
  sizes: StyleSizeSummarySize[];
  totalWaiting: number;
  totalIssued: number;
  totalWithContractor: number;
  totalStitched: number;
  totalDefects: number;
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
  buyerStyleRef?: string | null;
  /** Pieces LEFT to issue (what cutting sent, less what stitching issues took) */
  totalGoodPieces: number;
  /** What cutting sent */
  sentPieces: number;
  transferDate: string;
  issuedTo: string | null;
  /** Sizes with pieces left, in size order */
  skuBreakdown: Array<{
    colorId: string | null;
    colorName: string;
    sizeId: string;
    sizeName: string;
    sortOrder: number;
    /** Left to issue */
    quantity: number;
    /** What cutting sent */
    sentQty: number;
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
