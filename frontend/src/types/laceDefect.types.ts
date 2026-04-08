/**
 * Lace Defect Types
 * Types for lace defect logging and claim management
 */

// Defect type
export type DefectType = 'WEAVE_DEFECT' | 'COLOR_VARIATION' | 'WIDTH_VARIATION' | 'DAMAGE';

// Discovery location
export type DiscoveredAt = 'RECEIVING' | 'CUTTING' | 'STITCHING' | 'QC';

// Claim status
export type ClaimStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RESOLVED';

// Lace defect record
export interface LaceDefect {
  id: string;
  stockId: string;
  laceId: string;
  orderId?: string | null;
  styleId?: string | null;

  // Defect details
  defectType: DefectType;
  defectQuantity: number;
  defectDescription?: string | null;
  discoveredAt: DiscoveredAt;
  discoveredDate: string;
  discoveredById: string;
  photos?: string[] | null;

  // Claim tracking
  claimStatus: ClaimStatus;
  claimReference?: string | null;
  claimAmount?: number | null;
  claimSubmittedDate?: string | null;
  claimResolvedDate?: string | null;
  claimResolution?: string | null;

  // Replacement
  replacementRequired: boolean;
  replacementStockId?: string | null;
  replacementQuantity?: number | null;

  // Audit
  createdAt: string;
  updatedAt: string;

  // Relations
  discoveredBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  stock?: {
    id: string;
    lotNumber?: string | null;
    dyeLotNumber?: string | null;
  };
  lace?: {
    id: string;
    laceCode: string;
    laceName: string;
  };
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

// Log defect input
export interface LogDefectInput {
  stockId: string;
  laceId: string;
  orderId?: string;
  styleId?: string;
  defectType: DefectType;
  defectQuantity: number;
  defectDescription?: string;
  discoveredAt: DiscoveredAt;
  photos?: string[];
}

// Submit claim input
export interface SubmitClaimInput {
  claimReference: string;
  claimAmount: number;
  notes?: string;
}

// Update claim status input
export interface UpdateClaimStatusInput {
  status: ClaimStatus;
  resolution?: string;
}

// Record replacement input
export interface RecordReplacementInput {
  replacementStockId: string;
  replacementQuantity: number;
}

// Defect filters
export interface DefectFilters {
  stockId?: string;
  laceId?: string;
  orderId?: string;
  styleId?: string;
  defectType?: DefectType;
  claimStatus?: ClaimStatus;
  discoveredAt?: DiscoveredAt;
  search?: string;
  page?: number;
  limit?: number;
}

// Defect list response
export interface DefectListResponse {
  success: boolean;
  data: LaceDefect[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Pending claims response
export interface PendingClaimsResponse {
  pending: {
    count: number;
    totalQuantity: number;
    items: LaceDefect[];
  };
  submitted: {
    count: number;
    totalClaimAmount: number;
    items: LaceDefect[];
  };
}

// Defect statistics
export interface DefectStatistics {
  totalDefects: number;
  byType: {
    type: DefectType;
    count: number;
    totalQuantity: number;
  }[];
  byDiscoveredAt: {
    stage: DiscoveredAt;
    count: number;
  }[];
  byStatus: {
    status: ClaimStatus;
    count: number;
  }[];
}

// Defect type labels
export const DEFECT_TYPE_LABELS: Record<DefectType, string> = {
  WEAVE_DEFECT: 'Weave Defect',
  COLOR_VARIATION: 'Color Variation',
  WIDTH_VARIATION: 'Width Variation',
  DAMAGE: 'Damage',
};

// Defect type colors
export const DEFECT_TYPE_COLORS: Record<DefectType, string> = {
  WEAVE_DEFECT: 'bg-destructive/10 text-destructive border-destructive/20',
  COLOR_VARIATION: 'bg-accent/10 text-accent border-accent/20',
  WIDTH_VARIATION: 'bg-orange-100 text-orange-800 border-orange-200',
  DAMAGE: 'bg-destructive/10 text-destructive border-destructive/20',
};

// Discovered at labels
export const DISCOVERED_AT_LABELS: Record<DiscoveredAt, string> = {
  RECEIVING: 'Receiving',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  QC: 'Quality Check',
};

// Claim status labels
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RESOLVED: 'Resolved',
};

// Claim status colors
export const CLAIM_STATUS_COLORS: Record<ClaimStatus, string> = {
  PENDING: 'bg-muted text-foreground border-border',
  SUBMITTED: 'bg-info-muted text-info border-info/20',
  APPROVED: 'bg-success-muted text-success border-success/20',
  REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
  RESOLVED: 'bg-accent/10 text-accent border-accent/20',
};

// Valid claim status transitions
export const CLAIM_STATUS_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['RESOLVED'],
  REJECTED: ['RESOLVED'],
  RESOLVED: [],
};
