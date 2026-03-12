// Credit Note Types

export type DocumentStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';

export const DocumentStatusLabels: Record<DocumentStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  CANCELLED: 'Cancelled',
};

export const DocumentStatusColors: Record<DocumentStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  APPROVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export type CreditNoteReason = 'SALES_RETURN' | 'RATE_DIFFERENCE' | 'QUALITY_ISSUE' | 'QUANTITY_DIFFERENCE' | 'OTHER';

export const CreditNoteReasonLabels: Record<CreditNoteReason, string> = {
  SALES_RETURN: 'Sales Return',
  RATE_DIFFERENCE: 'Rate Difference',
  QUALITY_ISSUE: 'Quality Issue',
  QUANTITY_DIFFERENCE: 'Quantity Difference',
  OTHER: 'Other',
};

export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  invoiceItemId?: string | null;
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

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  invoiceId: string;
  customerId: string;
  creditNoteDate: string;
  reason: CreditNoteReason;
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

  // Relations (camelCase from serializer)
  invoice?: {
    id: string;
    invoiceNumber: string;
  };
  customer?: {
    id: string;
    code: string;
    name: string;
    billingName?: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  items?: CreditNoteItem[];
}

export interface CreateCreditNoteRequest {
  invoiceId: string;
  customerId: string;
  creditNoteDate?: string;
  reason: CreditNoteReason;
  remarks?: string;
  items: Array<{
    invoiceItemId?: string;
    description: string;
    hsnCode?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface CreditNoteQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DocumentStatus;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreditNoteListResponse {
  data: CreditNote[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
