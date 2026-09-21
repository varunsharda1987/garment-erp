/**
 * Wash-care codes per buyer per fabric.
 */

import api from '@/lib/api';

export interface WashCareRow {
  id: string;
  customerId: string;
  greigeId: string;
  colorId: string | null;
  washCareCode: string;
  notes: string | null;
  customer?: { id: string; name: string; code: string } | null;
  color?: { id: string; colorName: string } | null;
}

export const washCareService = {
  /** Every buyer's code for one fabric. */
  listForGreige: async (greigeId: string): Promise<{ data: WashCareRow[] }> => {
    const { data } = await api.get('/wash-care-codes', { params: { greigeId } });
    return data;
  },

  /** Upsert — saving the same buyer + fabric again replaces the code rather than duplicating. */
  set: async (payload: {
    customerId: string;
    greigeId: string;
    washCareCode: string;
    colorId?: string | null;
    notes?: string | null;
  }): Promise<{ data: WashCareRow }> => {
    const { data } = await api.post('/wash-care-codes', payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/wash-care-codes/${id}`);
  },
};
