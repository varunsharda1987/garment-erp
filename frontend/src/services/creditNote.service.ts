import api from '@/lib/api';
import type {
  CreditNote,
  CreateCreditNoteRequest,
  CreditNoteListResponse,
  CreditNoteQueryParams,
} from '@/types/creditNote.types';

const BASE_PATH = '/credit-notes';

export const creditNoteService = {
  async getAll(params?: CreditNoteQueryParams): Promise<CreditNoteListResponse> {
    const { data } = await api.get(BASE_PATH, { params });
    return data;
  },

  async getById(id: string): Promise<CreditNote> {
    const { data } = await api.get(`${BASE_PATH}/${id}`);
    return data.data;
  },

  async create(payload: CreateCreditNoteRequest): Promise<CreditNote> {
    const { data } = await api.post(BASE_PATH, payload);
    return data.data;
  },

  async approve(id: string): Promise<CreditNote> {
    const { data } = await api.put(`${BASE_PATH}/${id}/approve`);
    return data.data;
  },

  async cancel(id: string): Promise<CreditNote> {
    const { data } = await api.put(`${BASE_PATH}/${id}/cancel`);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE_PATH}/${id}`);
  },
};
