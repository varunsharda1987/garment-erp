/**
 * Sample Module Types
 * Type definitions for sample tracking management
 * Covers: FIT, PP, Size Set, Shipment, and Photoshoot samples
 */

// ============================================
// ENUMS
// ============================================

export type SampleType =
  | 'FIT_SAMPLE'
  | 'PP_SAMPLE'
  | 'SIZE_SET_SAMPLE'
  | 'SHIPMENT_SAMPLE'
  | 'PHOTO_SAMPLE'
  | 'PRODUCTION_SAMPLE';

export type SampleStatus =
  | 'REQUESTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT'
  | 'FEEDBACK_PENDING'
  | 'REVISION_NEEDED'
  | 'APPROVED_WITH_COMMENTS';

// ============================================
// RELATED TYPES
// ============================================

export interface SampleCustomer {
  id: string;
  code?: string;
  name: string;
}

export interface SampleStyle {
  id: string;
  styleCode: string;
  styleName: string;
  customerName?: string;
}

export interface SampleUser {
  id: string;
  name: string;
  email?: string;
}

export interface SampleColorOption {
  id: string;
  colorName: string;
  colorCode?: string;
}

export interface SampleSizeOption {
  id: string;
  sizeName: string;
  sizeCode: string;
}

// ============================================
// MEASUREMENT TYPES
// ============================================

export interface SampleMeasurement {
  id: string;
  sampleId: string;
  sizeId?: string | null;
  size?: SampleSizeOption | null;
  measurementPoint: string;
  specValue: number;
  actualValue?: number | null;
  tolerance: number;
  status?: string | null; // PASS, FAIL (auto-calculated)
  createdAt: string;
  updatedAt: string;
}

export interface SampleMeasurementInput {
  sizeId?: string;
  measurementPoint: string;
  specValue: number;
  actualValue?: number;
  tolerance: number;
}

// ============================================
// COLORWAY TYPES (for PP Samples)
// ============================================

export interface SampleColorway {
  id: string;
  sampleId: string;
  colorId: string;
  color?: SampleColorOption;
  sizeId?: string | null;
  size?: SampleSizeOption | null;
  fabricLot?: string | null;
  qtySent: number;
  status: string; // PENDING, APPROVED, REJECTED
}

export interface SampleColorwayInput {
  colorId: string;
  sizeId?: string;
  fabricLot?: string;
  qtySent: number;
  status?: string;
}

// ============================================
// SIZE SET TYPES (for Size Set Samples)
// ============================================

export interface SampleSizeSet {
  id: string;
  sampleId: string;
  sizeId: string;
  size?: SampleSizeOption;
  colorId: string;
  color?: SampleColorOption;
  qty: number;
  status: string; // PENDING, APPROVED, REJECTED
}

export interface SampleSizeSetInput {
  sizeId: string;
  colorId: string;
  qty: number;
  status?: string;
}

// ============================================
// MAIN SAMPLE TYPE
// ============================================

export interface Sample {
  id: string;
  sampleNumber: string;
  customerId: string;
  customer?: SampleCustomer;
  styleId?: string | null;
  style?: SampleStyle | null;
  sampleType: SampleType;
  requestDate: string;
  requiredDate: string;
  completionDate?: string | null;
  status: SampleStatus;
  customerFeedback?: string | null;
  remarks?: string | null;
  createdById: string;
  createdBy?: SampleUser;
  createdAt: string;

  // Extended fields for manufacturing module
  version: number; // For FIT revision tracking
  sentDate?: string | null;
  courierMode?: string | null;
  trackingNumber?: string | null;
  receivedDate?: string | null;
  feedbackDate?: string | null;
  measurementComments?: string | null;
  revisionRequired: boolean;
  nextAction?: string | null;
  linkedDispatchId?: string | null; // For shipment samples
  productionLot?: string | null; // For shipment samples
  sentTo?: string | null; // For photoshoot
  purpose?: string | null; // For photoshoot

  // Related data
  measurements?: SampleMeasurement[];
  colorways?: SampleColorway[];
  sizeSets?: SampleSizeSet[];
}

// ============================================
// REQUEST TYPES
// ============================================

export interface CreateSampleRequest {
  customerId: string;
  styleId?: string;
  sampleType: SampleType;
  requestDate?: string;
  requiredDate: string;
  remarks?: string;

  // Type-specific fields
  // FIT Sample
  sampleSizeId?: string; // Which size made for FIT sample

  // PP Sample
  fitSampleReference?: string; // Link to approved FIT sample

  // Size Set Sample
  ppSampleReference?: string; // Link to approved PP sample

  // Shipment Sample
  linkedDispatchId?: string;
  productionLot?: string;

  // Photoshoot Sample
  sentTo?: string;
  purpose?: string;

  // Nested data
  measurements?: SampleMeasurementInput[];
  colorways?: SampleColorwayInput[];
  sizeSets?: SampleSizeSetInput[];
}

export interface UpdateSampleRequest {
  requiredDate?: string;
  completionDate?: string;
  status?: SampleStatus;
  customerFeedback?: string;
  remarks?: string;

  // Shipping info
  sentDate?: string;
  courierMode?: string;
  trackingNumber?: string;
  receivedDate?: string;
  feedbackDate?: string;

  // Feedback
  measurementComments?: string;
  revisionRequired?: boolean;
  nextAction?: string;

  // Nested data updates
  measurements?: SampleMeasurementInput[];
  colorways?: SampleColorwayInput[];
  sizeSets?: SampleSizeSetInput[];
}

export interface UpdateSampleStatusRequest {
  status: SampleStatus;
  feedback?: string;
  comments?: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface SampleListResponse {
  data: Sample[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SampleResponse {
  data: Sample;
  message?: string;
}

// ============================================
// QUERY PARAMETERS
// ============================================

export interface SampleQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sampleType?: SampleType | SampleType[];
  status?: SampleStatus | SampleStatus[];
  customerId?: string;
  styleId?: string;
  fromDate?: string;
  toDate?: string;
  pendingApproval?: boolean;
}

// ============================================
// SUMMARY/STATS TYPES
// ============================================

export interface SampleSummary {
  total: number;
  byType: {
    type: SampleType;
    count: number;
  }[];
  byStatus: {
    status: SampleStatus;
    count: number;
  }[];
  pendingApproval: number;
  overdue: number;
  recentActivity: Sample[];
}

// ============================================
// UI HELPER TYPES
// ============================================

export const SampleTypeLabels: Record<SampleType, string> = {
  FIT_SAMPLE: 'FIT Sample',
  PP_SAMPLE: 'PP Sample (Pre-Production)',
  SIZE_SET_SAMPLE: 'Size Set Sample',
  SHIPMENT_SAMPLE: 'Shipment Sample',
  PHOTO_SAMPLE: 'Photoshoot Sample',
  PRODUCTION_SAMPLE: 'Production Sample',
};

export const SampleStatusLabels: Record<SampleStatus, string> = {
  REQUESTED: 'Requested',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SENT: 'Sent to Buyer',
  FEEDBACK_PENDING: 'Awaiting Feedback',
  REVISION_NEEDED: 'Revision Needed',
  APPROVED_WITH_COMMENTS: 'Approved (with comments)',
};

export const SampleStatusColors: Record<SampleStatus, string> = {
  REQUESTED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  SENT: 'bg-indigo-100 text-indigo-700',
  FEEDBACK_PENDING: 'bg-yellow-100 text-yellow-700',
  REVISION_NEEDED: 'bg-orange-100 text-orange-700',
  APPROVED_WITH_COMMENTS: 'bg-emerald-100 text-emerald-700',
};
