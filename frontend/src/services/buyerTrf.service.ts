/**
 * Buyer Test Requirement Form (TRF) — API client.
 *
 * Always through the shared `api` client, never bare fetch: the PDF and every read need the
 * Bearer header that lives on it.
 */

import api from '@/lib/api';
import type {
  BuyerTrf,
  BuyerTrfPrefill,
  BuyerTrfQueryParams,
  CreateBuyerTrfInput,
  UpdateBuyerTrfInput,
  PaginatedBuyerTrfs,
  TrfFormOptions,
} from '@/types/buyerTrf.types';

export const buyerTrfService = {
  getAll: async (params?: BuyerTrfQueryParams): Promise<PaginatedBuyerTrfs> => {
    const { data } = await api.get('/buyer-trfs', { params });
    return data;
  },

  getById: async (id: string): Promise<{ data: BuyerTrf }> => {
    const { data } = await api.get(`/buyer-trfs/${id}`);
    return data;
  },

  create: async (payload: CreateBuyerTrfInput): Promise<{ data: BuyerTrf }> => {
    const { data } = await api.post('/buyer-trfs', payload);
    return data;
  },

  update: async (id: string, payload: UpdateBuyerTrfInput): Promise<{ data: BuyerTrf }> => {
    const { data } = await api.put(`/buyer-trfs/${id}`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/buyer-trfs/${id}`);
  },

  /**
   * What a TRF for this style would be pre-filled with, without creating one.
   * Exactly one of workOrderId / saleOrderId must be given.
   * `sampleId` ticks the sample stage from the sample's type; `retestOfTrfId` starts the next lab
   * round from the previous sheet (switched to RETEST, previous report number filled).
   */
  getPrefill: async (params: {
    styleId: string;
    workOrderId?: string;
    saleOrderId?: string;
    sampleId?: string;
    retestOfTrfId?: string;
  }): Promise<{ data: BuyerTrfPrefill }> => {
    const { data } = await api.get('/buyer-trfs/prefill', { params });
    return data;
  },

  /** Every label and print order the form needs — the backend catalogue is the only copy. */
  getFormOptions: async (): Promise<{ data: TrfFormOptions }> => {
    const { data } = await api.get('/buyer-trfs/form-options');
    return data;
  },
};
