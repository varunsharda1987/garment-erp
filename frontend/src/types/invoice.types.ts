// ============================================
// Invoice Module Types
// ============================================

import type { State } from './location.types';

// ============================================
// Status Enums
// ============================================

export type InvoiceStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'SETTLED_WITH_CREDIT';

export const InvoiceStatusLabels: Record<InvoiceStatus, string> = {
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  SETTLED_WITH_CREDIT: 'Settled with Credit',
};

export const InvoiceStatusColors: Record<InvoiceStatus, string> = {
  PENDING: 'bg-muted text-foreground',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-success-muted text-success',
  OVERDUE: 'bg-destructive/10 text-destructive',
  SETTLED_WITH_CREDIT: 'bg-info-muted text-info',
};

export type PaymentMethod = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'UPI';

export const PaymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  BANK_TRANSFER: 'Bank Transfer',
  UPI: 'UPI',
};

// ============================================
// Payment Types
// ============================================

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  remarks?: string;
  receivedById: string;
  createdAt: string;

  // Relations
  users?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// ============================================
// Invoice Item Types
// ============================================

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  styleId?: string | null;
  description: string;
  hsnCode?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  gstRate?: number | null;
  cgstRate?: number | null;
  cgstAmount?: number | null;
  sgstRate?: number | null;
  sgstAmount?: number | null;
  igstRate?: number | null;
  igstAmount?: number | null;
  taxAmount?: number | null;
  remarks?: string | null;
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    buyerStyleRef?: string | null;
    hsnCode?: string | null;
  } | null;
}

// ============================================
// Invoice Types
// ============================================

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;

  invoiceDate: string;
  dueDate: string;

  status: InvoiceStatus;

  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;

  remarks?: string;

  // GST Compliance Fields
  placeOfSupplyId?: string | null;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cgstRate?: number | null;
  sgstRate?: number | null;
  igstRate?: number | null;
  isInterstate: boolean;

  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Tally Push Fields
  tallyPushedAt?: string | null;
  tallyVoucherNumber?: string | null;
  tallyLastError?: string | null;

  // e-Invoice (IRN) Fields
  eInvoiceIrn?: string | null;
  eInvoiceAckNo?: string | null;
  eInvoiceAckDate?: string | null;
  eInvoiceQrCode?: string | null;
  eInvoiceStatus?: string | null;
  eInvoiceCancelledAt?: string | null;
  eInvoiceCancelReason?: string | null;
  eInvoiceLastError?: string | null;

  // Relations (serializer renames: customers→customer)
  customer?: {
    id: string;
    code: string;
    name: string;
    billingName?: string;
    email?: string;
    phone?: string;
  };
  orders?: {
    id: string;
    orderNumber: string;
    orderDate: string;
  };
  users?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  payments?: Payment[];
  placeOfSupply?: State | null;
  invoiceItems?: InvoiceItem[];
}

// ============================================
// Create/Update Request Types
// ============================================

export interface InvoiceItemInput {
  styleId?: string;
  description: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  remarks?: string;
}

export interface CreateInvoiceRequest {
  orderId: string;
  customerId: string;
  invoiceDate?: string;
  dueDate: string;
  subtotal: number;
  taxAmount?: number;
  totalAmount?: number;
  remarks?: string;
  taxRate?: number;
  placeOfSupplyId?: string;
  items?: InvoiceItemInput[];
}

export interface UpdateInvoiceRequest {
  invoiceDate?: string;
  dueDate?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  remarks?: string;
  /**
   * Line items. When present the server REBUILDS the lines and derives every money column from
   * them, ignoring any subtotal/taxAmount/totalAmount sent alongside — send one or the other, never
   * both. Omitting this leaves the existing lines untouched (the header-only edit path).
   */
  items?: InvoiceItemInput[];
}

export interface RecordPaymentRequest {
  amount: number;
  paymentDate?: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  remarks?: string;
}

// ============================================
// API Response Types
// ============================================

export interface InvoiceListResponse {
  data: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InvoiceSummary {
  total: number;
  pending: number;
  partiallyPaid: number;
  paid: number;
  overdue: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
}

// ============================================
// Query Parameters
// ============================================

export interface InvoiceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
  orderId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
