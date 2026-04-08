/**
 * Lace Lab Dip Types
 * Types for lace lab dip approval workflow
 */

// Lab dip status enum
export type LabDipStatus =
  | 'PENDING'
  | 'SENT_TO_PROCESSOR'
  | 'SAMPLE_RECEIVED'
  | 'AWAITING_BUYER_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

// Lab dip interface
export interface LaceLabDip {
  id: string;
  labDipNumber: string;

  // Lace & Color
  greigeLaceId: string;
  targetColor: string;
  colorRecipe?: string | null;

  // Processor
  processorId: string;
  sampleQuantity: number;

  // Tracking dates
  requestDate: string;
  sentToProcessorDate?: string | null;
  sampleReceivedDate?: string | null;
  sentToBuyerDate?: string | null;
  buyerDecisionDate?: string | null;

  // Status
  status: LabDipStatus;

  // Buyer feedback
  buyerRemarks?: string | null;
  rejectionReason?: string | null;
  approvalReference?: string | null;

  // Cost tracking
  labDipCost?: number | null;

  // Links
  costSheetId?: string | null;
  styleId?: string | null;

  // Audit fields
  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Relations (populated by API)
  greigeLace?: {
    id: string;
    laceCode: string;
    laceName: string;
    width?: number;
    composition?: string;
  };
  processor?: {
    id: string;
    code: string;
    name: string;
    contactPerson?: string;
    phone?: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  style?: {
    id: string;
    styleCode: string;
    styleName?: string;
  };
}

// Create lab dip input
export interface CreateLabDipInput {
  greigeLaceId: string;
  targetColor: string;
  processorId: string;
  sampleQuantity?: number;
  colorRecipe?: string;
  styleId?: string;
  costSheetId?: string;
  labDipCost?: number;
}

// Update lab dip input
export interface UpdateLabDipInput {
  targetColor?: string;
  colorRecipe?: string;
  sampleQuantity?: number;
  labDipCost?: number;
  styleId?: string;
  costSheetId?: string;
}

// Status update input
export interface UpdateLabDipStatusInput {
  status: LabDipStatus;
  buyerRemarks?: string;
  rejectionReason?: string;
  approvalReference?: string;
}

// Lab dip list response
export interface LabDipListResponse {
  success: boolean;
  data: LaceLabDip[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Lab dip list filters
export interface LabDipListFilters {
  page?: number;
  limit?: number;
  status?: LabDipStatus;
  greigeLaceId?: string;
  processorId?: string;
  styleId?: string;
  costSheetId?: string;
}

// Status badge colors
export const LAB_DIP_STATUS_COLORS: Record<LabDipStatus, string> = {
  PENDING: 'bg-muted text-foreground border-border',
  SENT_TO_PROCESSOR: 'bg-info-muted text-info border-info/20',
  SAMPLE_RECEIVED: 'bg-accent/10 text-accent border-accent/20',
  AWAITING_BUYER_APPROVAL: 'bg-warning/10 text-warning border-warning/20',
  APPROVED: 'bg-success-muted text-success border-success/20',
  REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
};

// Status labels
export const LAB_DIP_STATUS_LABELS: Record<LabDipStatus, string> = {
  PENDING: 'Pending',
  SENT_TO_PROCESSOR: 'Sent to Processor',
  SAMPLE_RECEIVED: 'Sample Received',
  AWAITING_BUYER_APPROVAL: 'Awaiting Buyer',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

// Valid status transitions
export const LAB_DIP_STATUS_TRANSITIONS: Record<LabDipStatus, LabDipStatus[]> = {
  PENDING: ['SENT_TO_PROCESSOR'],
  SENT_TO_PROCESSOR: ['SAMPLE_RECEIVED'],
  SAMPLE_RECEIVED: ['AWAITING_BUYER_APPROVAL'],
  AWAITING_BUYER_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: ['PENDING'], // Can restart the process
};
