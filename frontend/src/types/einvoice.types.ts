// GST e-Invoice (IRN) types — mirror backend/src/schemas/einvoice.schema.ts + einvoice.service.ts

export interface EInvoiceSettings {
  id: string;
  einvEnabled: boolean;
  einvMode: 'SANDBOX' | 'PRODUCTION';
  einvProvider: string;
  einvBaseUrl?: string | null;
  einvClientId: string; // masked ('••••••••') when set
  einvClientSecret: string; // masked when set
  einvApiUsername: string;
  einvApiPassword: string; // masked when set
  einvGstin: string;
  einvPublicKeyPem?: string | null;
  einvAutoGenerateOnCreate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EInvoiceSettingsUpdateRequest {
  einvEnabled?: boolean;
  einvMode?: 'SANDBOX' | 'PRODUCTION';
  einvProvider?: string;
  einvBaseUrl?: string | null;
  einvClientId?: string;
  einvClientSecret?: string;
  einvApiUsername?: string;
  einvApiPassword?: string;
  einvGstin?: string;
  einvPublicKeyPem?: string | null;
  einvAutoGenerateOnCreate?: boolean;
}

export interface EInvoiceTestResult {
  ok: boolean;
  tokenExpiry?: string;
  message: string;
}

export interface EInvoicePreflightResult {
  eligible: boolean;
  problems: string[];
  warnings: string[];
  payload?: unknown;
}

export interface GenerateIrnResult {
  success: boolean;
  irn?: string;
  ackNo?: string;
  ackDt?: string;
  error?: string;
  problems?: string[];
  warnings?: string[];
}

export interface CancelIrnRequest {
  reason: '1' | '2' | '3' | '4';
  remarks: string;
}

export interface CancelIrnResult {
  success: boolean;
  cancelDate?: string;
  error?: string;
}

export interface EInvoiceInvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  buyerGstin: string | null;
  b2c: boolean;
  totalAmount: number;
  isInterstate: boolean;
  eInvoiceIrn: string | null;
  eInvoiceStatus: string | null;
  eInvoiceAckNo: string | null;
  eInvoiceAckDate: string | null;
  eInvoiceLastError: string | null;
  eInvoiceCancelledAt: string | null;
}

export interface EInvoiceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  irnStatus?: 'all' | 'not_generated' | 'generated' | 'cancelled' | 'error';
}

export interface EInvoiceListResult {
  data: EInvoiceInvoiceRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
