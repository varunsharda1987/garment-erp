// Debit Note Types

import type { DocumentStatus } from './creditNote.types';
export type { DocumentStatus };

export type DebitNoteReason =
  | 'PURCHASE_RETURN'
  | 'RATE_DIFFERENCE'
  | 'QUALITY_ISSUE'
  | 'QUANTITY_SHORT'
  | 'DAMAGED_GOODS'
  | 'OTHER';

export const DebitNoteReasonLabels: Record<DebitNoteReason, string> = {
  PURCHASE_RETURN: 'Purchase Return',
  RATE_DIFFERENCE: 'Rate Difference',
  QUALITY_ISSUE: 'Quality Issue',
  QUANTITY_SHORT: 'Quantity Short',
  DAMAGED_GOODS: 'Damaged Goods',
  OTHER: 'Other',
};

export interface DebitNoteItem {
  id: string;
  debitNoteId: string;
  poItemId?: string | null;
  description: string;
  hsnCode?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  gstRate?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  taxAmount?: number | null;
}

export interface DebitNote {
  id: string;
  debitNoteNumber: string;
  poId?: string | null;
  supplierId: string;
  debitNoteDate: string;
  reason: DebitNoteReason;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
  isInterstate: boolean;
  status: DocumentStatus;
  remarks?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  purchaseOrder?: {
    id: string;
    poNumber: string;
  } | null;
  supplier?: {
    id: string;
    code: string;
    name: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  items?: DebitNoteItem[];
}

export interface CreateDebitNoteRequest {
  poId?: string;
  supplierId: string;
  debitNoteDate?: string;
  reason: DebitNoteReason;
  remarks?: string;
  items: Array<{
    poItemId?: string;
    description: string;
    hsnCode?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface DebitNoteQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DocumentStatus;
  supplierId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DebitNoteListResponse {
  data: DebitNote[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
