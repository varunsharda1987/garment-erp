// ============================================
// Quotation Module Types
// Updated: Force Vite cache refresh
// ============================================

import type { State } from './location.types';

// ============================================
// Status Enums
// ============================================

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export const QuotationStatusLabels: Record<QuotationStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

export const QuotationStatusColors: Record<QuotationStatus, string> = {
  DRAFT: 'bg-muted text-foreground',
  SENT: 'bg-info-muted text-info',
  ACCEPTED: 'bg-success-muted text-success',
  REJECTED: 'bg-destructive/10 text-destructive',
  EXPIRED: 'bg-orange-100 text-orange-800',
};

// ============================================
// Quotation Item Types
// ============================================

export interface QuotationItem {
  id: string;
  quotationId: string;
  styleId: string;
  description?: string;
  totalQuantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveryDays?: number;
  remarks?: string;
  // GST fields
  hsnCode?: string | null;
  gstRate?: number | null;
  cgstRate?: number | null;
  cgstAmount?: number | null;
  sgstRate?: number | null;
  sgstAmount?: number | null;
  igstRate?: number | null;
  igstAmount?: number | null;
  taxAmount?: number | null;

  // Relations (serializer renames: styles→style)
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    buyerStyleRef?: string | null;
  };
}

// ============================================
// Quotation Types
// ============================================

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;

  quotationDate: string;
  validUntil: string;

  status: QuotationStatus;

  totalAmount?: number;
  remarks?: string;
  termsAndConditions?: string;

  // Tax Estimation Fields (Optional)
  placeOfSupplyId?: string | null;
  taxRate?: number | null;
  estimatedCGST?: number | null;
  estimatedSGST?: number | null;
  estimatedIGST?: number | null;
  totalWithTax?: number | null;

  createdById: string;
  approvedById?: string;
  createdAt: string;
  updatedAt: string;

  // Relations (serializer renames: customers→customer, quotationItems→items)
  customer?: {
    id: string;
    code: string;
    name: string;
    billingName?: string;
    email?: string;
    phone?: string;
  };
  items?: QuotationItem[];
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  placeOfSupply?: State | null;
}

// ============================================
// Create/Update Request Types
// ============================================

export interface QuotationItemInput {
  styleId: string;
  description?: string;
  totalQuantity: number;
  unitPrice: number;
  deliveryDays?: number;
  remarks?: string;
}

export interface CreateQuotationRequest {
  customerId: string;
  quotationDate?: string;
  validUntil: string;
  remarks?: string;
  termsAndConditions?: string;
  items: QuotationItemInput[];
  includeTaxEstimate?: boolean;
  placeOfSupplyId?: string;
  taxRate?: number;
}

export interface UpdateQuotationRequest {
  quotationDate?: string;
  validUntil?: string;
  remarks?: string;
  termsAndConditions?: string;
  items?: QuotationItemInput[];
  status?: QuotationStatus;
}

export interface UpdateQuotationStatusRequest {
  status: QuotationStatus;
}

// ============================================
// API Response Types
// ============================================

export interface QuotationListResponse {
  data: Quotation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface QuotationSummary {
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  rejected: number;
  expired: number;
  totalValue: number;
  acceptedValue: number;
}

// ============================================
// Query Parameters
// ============================================

export interface QuotationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: QuotationStatus;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
