/**
 * Lace Stock Types
 * Types for lace stock management, allocation, and transfers
 */

// Stock status
export type LaceStockStatus = 'AVAILABLE' | 'RESERVED' | 'ISSUED' | 'CONSUMED' | 'PENDING_RETURN' | 'RETURNED';

// Stock type
export type LaceStockType = 'PLANNED_STOCK' | 'EXCESS' | 'EXCESS_MOQ' | 'RETURNED' | 'GENERIC';

// Quality grade
export type LaceQualityGrade = 'A' | 'B' | 'DEFECT';

// Allocation type
export type LaceAllocationType = 'SAME_STYLE' | 'CROSS_STYLE_REUSE' | 'INTER_ORDER_TRANSFER' | 'GENERIC_STOCK';

// Allocation status
export type LaceAllocationStatus = 'RESERVED' | 'IN_USE' | 'CONSUMED' | 'RETURNED' | 'TRANSFERRED';

// Transaction type
export type LaceTransactionType =
  | 'STOCK_IN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ALLOCATION'
  | 'CONSUMPTION'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'QUALITY_DOWNGRADE';

// Lace stock record
export interface LaceStock {
  id: string;

  // Core identification
  laceId: string;
  lotNumber?: string | null;
  rollNumbers?: string | null;
  dyeLotNumber?: string | null;

  // Origin tracking
  originStyleId?: string | null;
  originOrderId?: string | null;
  originStyleCode?: string | null;
  procurementId?: string | null;
  processingBatchId?: string | null;

  // Location
  warehouseLocation?: string | null;
  rackNumber?: string | null;

  // Stock details
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  unit: string;

  // Cost tracking
  weightedAvgCost: number;
  purchaseCost: number;

  // Quality & Status
  qualityGrade: LaceQualityGrade;
  status: LaceStockStatus;
  stockType: LaceStockType;

  // Dates
  receivedDate: string;
  lastConsumedDate?: string | null;
  agingDays: number;

  // Return status
  returnStatus?: string | null;
  returnReason?: string | null;
  returnRequestDate?: string | null;
  returnConfirmedDate?: string | null;
  restockingFee?: number | null;

  // Audit
  createdAt: string;
  updatedAt: string;

  // Relations (populated by API)
  laceMaster?: {
    id: string;
    laceCode: string;
    laceName: string;
    color?: string | null;
    width?: number | null;
    composition?: string | null;
    isGreige: boolean;
  };
  originStyle?: {
    id: string;
    styleCode: string;
    styleName?: string | null;
  };
  originOrder?: {
    id: string;
    orderNumber: string;
  };
}

// Stock allocation record
export interface LaceStockAllocation {
  id: string;
  stockId: string;

  // Current allocation
  orderId: string;
  styleId: string;
  styleCode: string;

  // Origin tracking
  originalStyleId?: string | null;
  originalStyleCode?: string | null;
  originalOrderId?: string | null;

  // Transfer info
  allocationType: LaceAllocationType;
  transferredFromStyleId?: string | null;
  transferDate?: string | null;
  transferNotes?: string | null;

  // Quantities
  quantityAllocated: number;
  quantityConsumed: number;
  quantityReturned: number;

  // Status
  allocationStatus: LaceAllocationStatus;

  // Audit
  createdById: string;
  createdAt: string;

  // Relations
  stock?: LaceStock;
  order?: {
    id: string;
    orderNumber: string;
  };
  style?: {
    id: string;
    styleCode: string;
    styleName?: string | null;
  };
}

// Stock transaction record
export interface LaceStockTransaction {
  id: string;
  stockId: string;
  transactionType: LaceTransactionType;
  quantity: number;
  balanceAfter: number;

  // Transfer-specific
  fromStyleId?: string | null;
  toStyleId?: string | null;
  fromStyleCode?: string | null;
  toStyleCode?: string | null;

  // Reference
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;

  // Audit
  transactionDate: string;
  performedById: string;
  performedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// Create stock input
export interface CreateLaceStockInput {
  laceId: string;
  lotNumber?: string;
  rollNumbers?: string;
  dyeLotNumber?: string;
  originStyleId?: string;
  originOrderId?: string;
  procurementId?: string;
  processingBatchId?: string;
  warehouseLocation?: string;
  rackNumber?: string;
  quantityAvailable: number;
  weightedAvgCost: number;
  purchaseCost: number;
  qualityGrade?: LaceQualityGrade;
  stockType?: LaceStockType;
  receivedDate: string;
}

// Allocate stock input
export interface AllocateStockInput {
  orderId: string;
  styleId: string;
  quantityAllocated: number;
  allocationType?: LaceAllocationType;
  notes?: string;
}

// Transfer stock input
export interface TransferStockInput {
  toStyleId: string;
  toOrderId: string;
  quantity: number;
  transferNotes?: string;
}

// Consume stock input
export interface ConsumeStockInput {
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}

// Return stock input
export interface ReturnStockInput {
  quantity: number;
  notes?: string;
}

// List filters
export interface LaceStockListFilters {
  page?: number;
  limit?: number;
  laceId?: string;
  status?: LaceStockStatus;
  qualityGrade?: LaceQualityGrade;
  stockType?: LaceStockType;
  originStyleId?: string;
  warehouseLocation?: string;
  minAgingDays?: number;
  maxAgingDays?: number;
  search?: string;
}

// List response
export interface LaceStockListResponse {
  success: boolean;
  data: LaceStock[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number; // backend returns totalPages, not pages (bug-hunt orders-13)
  };
}

// Aging report item
export interface LaceStockAgingItem {
  id: string;
  laceId: string;
  laceName: string;
  laceCode: string;
  lotNumber?: string | null;
  quantityAvailable: number;
  weightedAvgCost: number;
  totalValue: number;
  receivedDate: string;
  agingDays: number;
  agingBucket: '0-30' | '31-60' | '61-90' | '90+';
  originStyleCode?: string | null;
}

// Utilization report
export interface LaceStockUtilizationReport {
  totalStock: number;
  totalValue: number;
  utilizationRate: number;
  turnoverDays: number;
  byStatus: {
    status: LaceStockStatus;
    quantity: number;
    value: number;
    percentage: number;
  }[];
  byStockType: {
    stockType: LaceStockType;
    quantity: number;
    value: number;
    percentage: number;
  }[];
  crossStyleReuses: number;
  totalTransfers: number;
}

// Status badge colors
export const LACE_STOCK_STATUS_COLORS: Record<LaceStockStatus, string> = {
  AVAILABLE: 'bg-success-muted text-success border-success/20',
  RESERVED: 'bg-info-muted text-info border-info/20',
  ISSUED: 'bg-accent/10 text-accent border-accent/20',
  CONSUMED: 'bg-muted text-foreground border-border',
  PENDING_RETURN: 'bg-warning/10 text-warning border-warning/20',
  RETURNED: 'bg-orange-100 text-orange-800 border-orange-200',
};

// Status labels
export const LACE_STOCK_STATUS_LABELS: Record<LaceStockStatus, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  ISSUED: 'Issued',
  CONSUMED: 'Consumed',
  PENDING_RETURN: 'Pending Return',
  RETURNED: 'Returned',
};

// Quality grade colors
export const LACE_QUALITY_GRADE_COLORS: Record<LaceQualityGrade, string> = {
  A: 'bg-success-muted text-success border-success/20',
  B: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  DEFECT: 'bg-destructive/10 text-destructive border-destructive/20',
};

// Stock type labels
export const LACE_STOCK_TYPE_LABELS: Record<LaceStockType, string> = {
  PLANNED_STOCK: 'Planned',
  EXCESS: 'Excess',
  EXCESS_MOQ: 'MOQ Excess',
  RETURNED: 'Returned',
  GENERIC: 'Generic',
};

// Transaction type labels
export const LACE_TRANSACTION_TYPE_LABELS: Record<LaceTransactionType, string> = {
  STOCK_IN: 'Stock In',
  TRANSFER_OUT: 'Transfer Out',
  TRANSFER_IN: 'Transfer In',
  ALLOCATION: 'Allocation',
  CONSUMPTION: 'Consumption',
  RETURN: 'Return',
  ADJUSTMENT: 'Adjustment',
  QUALITY_DOWNGRADE: 'Quality Downgrade',
};

// Aging bucket colors
export const AGING_BUCKET_COLORS: Record<string, string> = {
  '0-30': 'bg-success-muted text-success',
  '31-60': 'bg-yellow-100 text-yellow-800',
  '61-90': 'bg-orange-100 text-orange-800',
  '90+': 'bg-destructive/10 text-destructive',
};
