import api from '../lib/api';
import type {
  TallySettings,
  TallySettingsUpdateRequest,
  TallyLedger,
  TestConnectionResult,
  CreateLedgersResult,
  CustomerMatchQueryParams,
  CustomerMatchResult,
  AutoMatchResult,
  SupplierMatchQueryParams,
  SupplierMatchResult,
  InvoiceTallyQueryParams,
  InvoiceTallyResult,
  PushInvoiceResult,
  CreditNoteTallyQueryParams,
  CreditNoteTallyResult,
  PushCreditNoteResult,
  DebitNoteTallyQueryParams,
  DebitNoteTallyResult,
  PushDebitNoteResult,
  PaymentTallyQueryParams,
  PaymentTallyResult,
  PushPaymentResult,
  OutstandingResult,
} from '../types/tally.types';

export async function getTallySettings(): Promise<TallySettings> {
  const response = await api.get('/tally/settings');
  return response.data.data;
}

export async function updateTallySettings(data: TallySettingsUpdateRequest): Promise<TallySettings> {
  const response = await api.put('/tally/settings', data);
  return response.data.data;
}

export async function testTallyConnection(): Promise<TestConnectionResult> {
  const response = await api.post('/tally/test');
  return response.data.data;
}

export async function getTallyLedgers(): Promise<TallyLedger[]> {
  const response = await api.get('/tally/ledgers');
  return response.data.data;
}

export async function getTallyVoucherTypes(): Promise<string[]> {
  const response = await api.get('/tally/voucher-types');
  return response.data.data;
}

export async function getTallyGroups(): Promise<string[]> {
  const response = await api.get('/tally/groups');
  return response.data.data;
}

export async function createTallyMissingLedgers(): Promise<CreateLedgersResult> {
  const response = await api.post('/tally/create-ledgers');
  return response.data.data;
}

// Customer-Ledger Matching

export async function getTallyCustomers(params: CustomerMatchQueryParams): Promise<CustomerMatchResult> {
  const response = await api.get('/tally/customers', { params });
  return {
    data: response.data.data,
    pagination: response.data.pagination,
    stats: response.data.stats,
  };
}

export async function linkCustomerToTally(customerId: string, tallyLedgerName: string): Promise<void> {
  await api.put(`/tally/customers/${customerId}/link`, { tallyLedgerName });
}

export async function unlinkCustomerFromTally(customerId: string): Promise<void> {
  await api.delete(`/tally/customers/${customerId}/link`);
}

export async function autoMatchTallyCustomers(): Promise<AutoMatchResult> {
  const response = await api.post('/tally/customers/auto-match');
  return response.data.data;
}

// Invoice Push

export async function getTallyInvoices(params: InvoiceTallyQueryParams): Promise<InvoiceTallyResult> {
  const response = await api.get('/tally/invoices', { params });
  return {
    data: response.data.data,
    pagination: response.data.pagination,
  };
}

export async function pushInvoiceToTally(invoiceId: string): Promise<PushInvoiceResult> {
  const response = await api.post(`/tally/invoices/${invoiceId}/push`);
  return response.data.data;
}

// Credit Note Push

export async function getTallyCreditNotes(params: CreditNoteTallyQueryParams): Promise<CreditNoteTallyResult> {
  const response = await api.get('/tally/credit-notes', { params });
  return {
    data: response.data.data,
    pagination: response.data.pagination,
  };
}

export async function pushCreditNoteToTally(creditNoteId: string): Promise<PushCreditNoteResult> {
  const response = await api.post(`/tally/credit-notes/${creditNoteId}/push`);
  return response.data.data;
}

// Supplier-Ledger Matching

export async function getTallySuppliers(params: SupplierMatchQueryParams): Promise<SupplierMatchResult> {
  const response = await api.get('/tally/suppliers', { params });
  return {
    data: response.data.data,
    pagination: response.data.pagination,
    stats: response.data.stats,
  };
}

export async function linkSupplierToTally(supplierId: string, tallyLedgerName: string): Promise<void> {
  await api.put(`/tally/suppliers/${supplierId}/link`, { tallyLedgerName });
}

export async function unlinkSupplierFromTally(supplierId: string): Promise<void> {
  await api.delete(`/tally/suppliers/${supplierId}/link`);
}

export async function autoMatchTallySuppliers(): Promise<AutoMatchResult> {
  const response = await api.post('/tally/suppliers/auto-match');
  return response.data.data;
}

// Debit Note Push

export async function getTallyDebitNotes(params: DebitNoteTallyQueryParams): Promise<DebitNoteTallyResult> {
  const response = await api.get('/tally/debit-notes', { params });
  return {
    data: response.data.data,
    pagination: response.data.pagination,
  };
}

export async function pushDebitNoteToTally(debitNoteId: string): Promise<PushDebitNoteResult> {
  const response = await api.post(`/tally/debit-notes/${debitNoteId}/push`);
  return response.data.data;
}

// Payment (Receipt) Push

export async function getTallyPayments(params: PaymentTallyQueryParams): Promise<PaymentTallyResult> {
  const response = await api.get('/tally/payments', { params });
  return {
    data: response.data.data,
    pagination: response.data.pagination,
  };
}

export async function pushPaymentToTally(paymentId: string): Promise<PushPaymentResult> {
  const response = await api.post(`/tally/payments/${paymentId}/push`);
  return response.data.data;
}

// Outstanding / Receivables

export async function getTallyOutstanding(): Promise<OutstandingResult> {
  const response = await api.get('/tally/outstanding');
  return {
    data: response.data.data,
    summary: response.data.summary,
    fetchedAt: response.data.fetchedAt,
  };
}
