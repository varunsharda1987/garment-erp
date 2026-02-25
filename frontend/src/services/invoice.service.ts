/**
 * Invoice Service
 * API client for invoice management
 */

import api from '../lib/api';
import type {
  Invoice,
  InvoiceListResponse,
  InvoiceSummary,
  InvoiceQueryParams,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  RecordPaymentRequest,
  Payment,
} from '../types/invoice.types';

const INVOICE_API_PATH = '/invoices';

/**
 * Get all invoices with pagination and filters
 */
export const getInvoices = async (
  params: InvoiceQueryParams = {}
): Promise<InvoiceListResponse> => {
  const response = await api.get<InvoiceListResponse>(INVOICE_API_PATH, { params });
  return response.data;
};

/**
 * Get invoice by ID
 */
export const getInvoiceById = async (id: string): Promise<Invoice> => {
  const response = await api.get<{ data: Invoice }>(`${INVOICE_API_PATH}/${id}`);
  return response.data.data;
};

/**
 * Create a new invoice
 */
export const createInvoice = async (data: CreateInvoiceRequest): Promise<Invoice> => {
  const response = await api.post<{ data: Invoice; message: string }>(
    INVOICE_API_PATH,
    data
  );
  return response.data.data;
};

/**
 * Update invoice
 */
export const updateInvoice = async (
  id: string,
  data: UpdateInvoiceRequest
): Promise<Invoice> => {
  const response = await api.put<{ data: Invoice; message: string }>(
    `${INVOICE_API_PATH}/${id}`,
    data
  );
  return response.data.data;
};

/**
 * Delete invoice
 */
export const deleteInvoice = async (id: string): Promise<void> => {
  await api.delete(`${INVOICE_API_PATH}/${id}`);
};

/**
 * Record a payment for an invoice
 */
export const recordPayment = async (
  invoiceId: string,
  data: RecordPaymentRequest
): Promise<Payment> => {
  const response = await api.post<{ data: Payment; message: string }>(
    `${INVOICE_API_PATH}/${invoiceId}/payments`,
    data
  );
  return response.data.data;
};

/**
 * Get invoice summary statistics
 */
export const getInvoiceSummary = async (customerId?: string): Promise<InvoiceSummary> => {
  const params = customerId ? { customerId } : {};
  const response = await api.get<{ data: InvoiceSummary }>(
    `${INVOICE_API_PATH}/summary`,
    { params }
  );
  return response.data.data;
};

/**
 * Update overdue invoices (admin only)
 */
export const updateOverdueInvoices = async (): Promise<{ count: number }> => {
  const response = await api.post<{ data: { count: number }; message: string }>(
    `${INVOICE_API_PATH}/update-overdue`
  );
  return response.data.data;
};

export default {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  recordPayment,
  getInvoiceSummary,
  updateOverdueInvoices,
};
