import api from '@/lib/api';
import type {
  DebitNote,
  CreateDebitNoteRequest,
  DebitNoteListResponse,
  DebitNoteQueryParams,
} from '@/types/debitNote.types';

const BASE_PATH = '/debit-notes';

export const debitNoteService = {
  async getAll(params?: DebitNoteQueryParams): Promise<DebitNoteListResponse> {
    const { data } = await api.get(BASE_PATH, { params });
    return data;
  },

  async getById(id: string): Promise<DebitNote> {
    const { data } = await api.get(`${BASE_PATH}/${id}`);
    return data.data;
  },

  async create(payload: CreateDebitNoteRequest): Promise<DebitNote> {
    const { data } = await api.post(BASE_PATH, payload);
    return data.data;
  },

  async approve(id: string): Promise<DebitNote> {
    const { data } = await api.put(`${BASE_PATH}/${id}/approve`);
    return data.data;
  },

  async cancel(id: string): Promise<DebitNote> {
    const { data } = await api.put(`${BASE_PATH}/${id}/cancel`);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE_PATH}/${id}`);
  },
};
