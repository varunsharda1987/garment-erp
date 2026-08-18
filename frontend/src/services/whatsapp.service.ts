import api from '../lib/api';

export type WaState = 'disconnected' | 'initializing' | 'qr' | 'authenticated' | 'ready';

export interface WhatsAppStatus {
  state: WaState;
  qr: string | null;
  me: { name?: string; number?: string } | null;
  error: string | null;
  attention: string | null;
  sessionSaved: boolean;
}

/** One recipient's send outcome (a batch never aborts on a single failure). */
export interface WaSendResult {
  label?: string;
  to?: string;
  error?: string;
}

/** A staff member who can be messaged (has a WhatsApp number on file). */
export interface StaffContact {
  id: string;
  name: string;
  role: string;
  department: string | null;
  whatsappNumber: string;
}

/** One of the linked account's WhatsApp groups (recipient picker for document sharing). */
export interface WaGroup {
  id: string; // serialized chat id, e.g. 1203...@g.us
  name: string;
}

/**
 * Normalize a raw phone into a WhatsApp-sendable number: strip non-digits and leading
 * zeros, add the 91 country code to bare 10-digit Indian numbers. Null = not usable.
 * (Ported from the Kasya B2B sales app.)
 */
export function toWaNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 13 ? digits : null;
}

export const whatsappService = {
  // ── Linking (the logged-in user's own session) ──
  getStatus: async (): Promise<WhatsAppStatus> => {
    const res = await api.get<WhatsAppStatus>('/whatsapp/status');
    return res.data;
  },
  connect: async (): Promise<WhatsAppStatus> => {
    const res = await api.post<WhatsAppStatus>('/whatsapp/connect');
    return res.data;
  },
  disconnect: async (): Promise<WhatsAppStatus> => {
    const res = await api.post<WhatsAppStatus>('/whatsapp/disconnect');
    return res.data;
  },

  // ── Sending (through the logged-in user's own number) ──
  sendText: async (to: string, text: string): Promise<{ to: string }> => {
    const res = await api.post<{ data: { to: string }; message: string }>('/whatsapp/send-text', { to, text });
    return res.data.data;
  },

  sendDocument: async (payload: {
    type: 'invoice' | 'quotation' | 'order' | 'purchaseOrder' | 'jobWorkOrder';
    id: string;
    /** Single recipient (legacy callers). Provide this OR `recipients`. */
    to?: string;
    caption?: string;
    /** Multi-recipient fan-out — the PDF is generated once server-side. */
    recipients?: Array<{ to: string; label?: string }>;
  }): Promise<{ to?: string; results?: WaSendResult[] }> => {
    const res = await api.post<{ data: { to?: string; results?: WaSendResult[] }; message: string }>(
      '/whatsapp/send-document',
      payload
    );
    return res.data.data;
  },

  /** The linked account's WhatsApp groups (requires a ready session). */
  getGroups: async (): Promise<WaGroup[]> => {
    const res = await api.get<{ data: WaGroup[] }>('/whatsapp/groups');
    return res.data.data;
  },

  // ── Internal staff messaging (Phase 2) ──
  getStaffDirectory: async (): Promise<StaffContact[]> => {
    const res = await api.get<{ data: StaffContact[] }>('/whatsapp/staff-directory');
    return res.data.data;
  },
  messageStaff: async (payload: {
    userIds?: string[];
    department?: string;
    text: string;
  }): Promise<{ results: WaSendResult[] }> => {
    const res = await api.post<{ data: { results: WaSendResult[] } }>('/whatsapp/message-staff', payload);
    return res.data.data;
  },
};
