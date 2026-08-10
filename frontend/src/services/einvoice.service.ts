import api from '../lib/api';
import type {
  EInvoiceSettings,
  EInvoiceSettingsUpdateRequest,
  EInvoiceTestResult,
  EInvoicePreflightResult,
  GenerateIrnResult,
  CancelIrnRequest,
  CancelIrnResult,
  EInvoiceQueryParams,
  EInvoiceListResult,
} from '../types/einvoice.types';

export async function getEInvoiceSettings(): Promise<EInvoiceSettings> {
  const response = await api.get('/einvoice/settings');
  return response.data.data;
}

export async function updateEInvoiceSettings(data: EInvoiceSettingsUpdateRequest): Promise<EInvoiceSettings> {
  const response = await api.put('/einvoice/settings', data);
  return response.data.data;
}

export async function testEInvoiceConnection(): Promise<EInvoiceTestResult> {
  const response = await api.post('/einvoice/test');
  return response.data.data;
}

export async function getEInvoiceInvoices(params: EInvoiceQueryParams): Promise<EInvoiceListResult> {
  const response = await api.get('/einvoice/invoices', { params });
  return {
    data: response.data.data,
    pagination: response.data.pagination,
  };
}

export async function preflightEInvoice(invoiceId: string): Promise<EInvoicePreflightResult> {
  const response = await api.get(`/einvoice/invoices/${invoiceId}/preflight`);
  return response.data.data;
}

export async function generateIrn(invoiceId: string): Promise<GenerateIrnResult> {
  const response = await api.post(`/einvoice/invoices/${invoiceId}/generate`);
  return response.data.data;
}

export async function cancelIrn(invoiceId: string, data: CancelIrnRequest): Promise<CancelIrnResult> {
  const response = await api.post(`/einvoice/invoices/${invoiceId}/cancel`, data);
  return response.data.data;
}
