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
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
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

  // Relations
  styles?: {
    id: string;
    styleCode: string;
    styleName: string;
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

  // Relations
  customers?: {
    id: string;
    code: string;
    name: string;
    billingName?: string;
    email?: string;
    phone?: string;
  };
  quotationItems?: QuotationItem[];
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
