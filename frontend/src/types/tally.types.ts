export interface TallySettings {
  id: string;
  tallyEnabled: boolean;
  tallyHost: string;
  tallyPort: number;
  tallyCompanyName: string | null;
  tallyPartyGroup: string;
  tallyVoucherType: string;
  tallySalesLedgerIntra: string;
  tallySalesLedgerInter: string;
  tallyCgstLedger: string;
  tallySgstLedger: string;
  tallyIgstLedger: string;
  tallyCgstLedger18: string;
  tallySgstLedger18: string;
  tallyIgstLedger18: string;
  tallyRoundOffLedger: string;
  tallyFreightLedger: string;
  tallyGodownName: string;
  tallyStockUnit: string;
  createdAt: string;
  updatedAt: string;
}

export interface TallySettingsUpdateRequest {
  tallyEnabled?: boolean;
  tallyHost?: string;
  tallyPort?: number;
  tallyCompanyName?: string | null;
  tallyPartyGroup?: string;
  tallyVoucherType?: string;
  tallySalesLedgerIntra?: string;
  tallySalesLedgerInter?: string;
  tallyCgstLedger?: string;
  tallySgstLedger?: string;
  tallyIgstLedger?: string;
  tallyCgstLedger18?: string;
  tallySgstLedger18?: string;
  tallyIgstLedger18?: string;
  tallyRoundOffLedger?: string;
  tallyFreightLedger?: string;
  tallyGodownName?: string;
  tallyStockUnit?: string;
}

export interface TallyLedger {
  name: string;
  parent: string;
  gstin: string;
  regType: string;
}

export interface LedgerCheck {
  name: string;
  present: boolean;
  suggestion?: string;
}

export interface TestConnectionResult {
  companies: string[];
  companyConfigured: string | null;
  companyMatched: boolean;
  ledgers: LedgerCheck[];
  warnings: string[];
}

export interface CreateLedgersResult {
  created: string[];
  skipped: string[];
  failed: Array<{ name: string; error: string }>;
}

// Customer-Ledger Matching
export interface CustomerTallyMatch {
  id: string;
  code: string;
  name: string;
  billingName: string | null;
  gstNumber: string | null;
  tallyLedgerName: string | null;
  tallyMatched: boolean;
  suggestion?: string;
}

export interface CustomerMatchQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  matchStatus?: 'all' | 'matched' | 'unmatched';
  suggestions?: boolean;
}

export interface CustomerMatchStats {
  total: number;
  matched: number;
  unmatched: number;
}

export interface CustomerMatchResult {
  data: CustomerTallyMatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: CustomerMatchStats;
}

export interface AutoMatchResult {
  matched: number;
  total: number;
}

// Invoice Push
export interface InvoiceTallyStatus {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  totalAmount: number;
  tallyPushedAt: string | null;
  tallyVoucherNumber: string | null;
  tallyLastError: string | null;
  customerLinked: boolean;
}

export interface InvoiceTallyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  pushStatus?: 'all' | 'pushed' | 'not_pushed' | 'error';
}

export interface InvoiceTallyResult {
  data: InvoiceTallyStatus[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PushInvoiceResult {
  success: boolean;
  voucherNumber?: string;
  error?: string;
}

// Credit Note Push
export interface CreditNoteTallyStatus {
  id: string;
  creditNoteNumber: string;
  creditNoteDate: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  reason: string;
  tallyPushedAt: string | null;
  tallyVoucherNumber: string | null;
  tallyLastError: string | null;
  customerLinked: boolean;
}

export interface CreditNoteTallyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  pushStatus?: 'all' | 'pushed' | 'not_pushed' | 'error';
}

export interface CreditNoteTallyResult {
  data: CreditNoteTallyStatus[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PushCreditNoteResult {
  success: boolean;
  voucherNumber?: string;
  error?: string;
}

// Supplier-Ledger Matching
export interface SupplierTallyMatch {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  tallyLedgerName: string | null;
  tallyMatched: boolean;
  suggestion?: string;
}

export interface SupplierMatchQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  matchStatus?: 'all' | 'matched' | 'unmatched';
  suggestions?: boolean;
}

export interface SupplierMatchStats {
  total: number;
  matched: number;
  unmatched: number;
}

export interface SupplierMatchResult {
  data: SupplierTallyMatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: SupplierMatchStats;
}

// Debit Note Push
export interface DebitNoteTallyStatus {
  id: string;
  debitNoteNumber: string;
  debitNoteDate: string;
  poNumber: string | null;
  supplierName: string;
  totalAmount: number;
  reason: string;
  tallyPushedAt: string | null;
  tallyVoucherNumber: string | null;
  tallyLastError: string | null;
  supplierLinked: boolean;
}

export interface DebitNoteTallyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  pushStatus?: 'all' | 'pushed' | 'not_pushed' | 'error';
}

export interface DebitNoteTallyResult {
  data: DebitNoteTallyStatus[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PushDebitNoteResult {
  success: boolean;
  voucherNumber?: string;
  error?: string;
}

// Payment (Receipt) Push
export interface PaymentTallyStatus {
  id: string;
  invoiceNumber: string;
  paymentDate: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  tallyPushedAt: string | null;
  tallyVoucherNumber: string | null;
  tallyLastError: string | null;
  customerLinked: boolean;
}

export interface PaymentTallyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  pushStatus?: 'all' | 'pushed' | 'not_pushed' | 'error';
}

export interface PaymentTallyResult {
  data: PaymentTallyStatus[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PushPaymentResult {
  success: boolean;
  voucherNumber?: string;
  error?: string;
}

// Outstanding / Receivables
export interface OutstandingEntry {
  tallyLedgerName: string;
  tallyParent: string;
  tallyGstin: string;
  tallyBalance: number;
  tallyCreditDays: number | null;
  customerId: string | null;
  customerCode: string | null;
  customerName: string | null;
  erpBalance: number | null;
  difference: number | null;
  matched: boolean;
}

export interface OutstandingSummary {
  totalTallyBalance: number;
  totalErpBalance: number;
  totalDifference: number;
  matchedCount: number;
  unmatchedCount: number;
}

export interface OutstandingResult {
  data: OutstandingEntry[];
  summary: OutstandingSummary;
  fetchedAt: string;
}
