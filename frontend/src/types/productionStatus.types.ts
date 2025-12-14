import { ProductionStage } from './style.types';

// Blocker severity and types
export type BlockerType =
  | 'CAD_NOT_APPROVED'
  | 'COSTING_PENDING'
  | 'MATERIALS_NOT_ORDERED'
  | 'MATERIALS_NOT_RECEIVED'
  | 'TRIMS_NOT_ORDERED'
  | 'DELIVERY_OVERDUE'
  | 'PRODUCTION_STUCK'
  // Sample blockers
  | 'FIT_SAMPLE_NOT_APPROVED'
  | 'FIT_SAMPLE_PENDING_FEEDBACK'
  | 'PP_SAMPLE_NOT_APPROVED'
  | 'SIZE_SET_SAMPLE_NOT_APPROVED'
  | 'SHIPMENT_SAMPLE_NOT_APPROVED'
  // Inspection blockers
  | 'FABRIC_QC_FAILED'
  | 'INLINE_QC_FAILED'
  | 'FINAL_QC_FAILED';

export type BlockerSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface BlockerInfo {
  type: BlockerType;
  severity: BlockerSeverity;
  message: string;
  daysStuck: number | null;
}

export interface ActionInfo {
  label: string;
  route: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// Status filter types
export type StatusFilter = 'all' | 'running' | 'completed' | 'delayed' | 'attention';

// Main response interface
export interface ProductionStatusItem {
  // Style Core
  styleId: string;
  styleCode: string;
  internalCode: string | null;
  styleName: string;
  imageUrl: string | null;
  customerName: string | null;
  brandName: string | null;
  brandCategoryId: string | null;
  season: string | null;

  // Order Aggregation
  orders: {
    totalQuantity: number;
    totalValue: number;
    earliestOrderDate: string | null;
    latestDeliveryDate: string | null;
    orderCount: number;
  };

  // CAD Status
  cadStatus: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  approvedCadDate: string | null;

  // Production Tracking
  currentStage: ProductionStage;
  piecesInStage: number;
  lastUpdatedDate: string | null;

  // Stage Breakdown
  stageBreakdown: {
    ordersReceived: number;
    pendingCosting: number;
    pendingGreige: number;
    trimsNotOrdered: number;
    inPrinting: number;
    inDying: number;
    inEmbroidery: number;
    inHandwork: number;
    inCutting: number;
    inStitching: number;
    inFinishing: number;
    readyToShip: number;
    shipped: number;
    completed: number;
  };

  // Calculated Metrics
  overallProgress: number; // 0-100
  daysToDelivery: number | null;
  isDelayed: boolean;
  isOnTrack: boolean;

  // Blockers & Actions
  blockers: BlockerInfo[];
  suggestedActions: ActionInfo[];

  // Costing
  costing: {
    totalCostPerPiece: number | null;
    sellingPricePerPiece: number | null;
    profitMargin: number | null;
  } | null;

  // Material Status
  materialStatus: {
    fabricsOrdered: boolean;
    fabricsReceived: boolean;
    trimsOrdered: boolean;
    trimsReceived: boolean;
  };

  // Work Orders
  workOrders: {
    workOrderCount: number;
    totalPlannedQuantity: number;
    totalCompletedQuantity: number;
  };

  // Sample Approval Status
  sampleStatus: {
    fitSample: {
      exists: boolean;
      status: string | null;
      daysPending: number | null;
      sampleId: string | null;
    };
    ppSample: {
      exists: boolean;
      status: string | null;
      daysPending: number | null;
      sampleId: string | null;
    };
    sizeSetSample: {
      exists: boolean;
      status: string | null;
      daysPending: number | null;
      sampleId: string | null;
    };
    shipmentSample: {
      exists: boolean;
      status: string | null;
      daysPending: number | null;
      sampleId: string | null;
    };
  };

  // QC Inspection Status
  inspectionStatus: {
    fabricInspection: {
      completed: boolean;
      status: 'PASS' | 'FAIL' | 'PENDING' | null;
    };
    inlineQC: {
      completed: boolean;
      status: 'PASS' | 'FAIL' | 'PENDING' | null;
    };
    finalQC: {
      completed: boolean;
      status: 'PASS' | 'FAIL' | 'PENDING' | null;
    };
  };
}

// Query options
export interface ProductionStatusQueryOptions {
  page: number;
  limit: number;
  search?: string;
  brand?: string;
  customer?: string;
  status?: StatusFilter;
  stage?: ProductionStage;
  cadStatus?: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  orderDateFrom?: string;
  orderDateTo?: string;
  deliveryDateFrom?: string;
  deliveryDateTo?: string;
  sortBy?: 'orderDate' | 'deliveryDate' | 'status' | 'progress' | 'orderValue';
  sortOrder?: 'asc' | 'desc';
}

// Summary response
export interface ProductionStatusSummary {
  total: number;
  running: number;
  completed: number;
  delayed: number;
  needsAttention: number;
  totalOrderValue: number;
  totalPieces: number;
}

// List response
export interface ProductionStatusListResponse {
  data: ProductionStatusItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: ProductionStatusSummary;
}
