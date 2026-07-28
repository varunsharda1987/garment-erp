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
    type: 'invoice' | 'quotation' | 'order' | 'purchaseOrder';
    id: string;
    to: string;
    caption?: string;
  }): Promise<{ to: string }> => {
    const res = await api.post<{ data: { to: string }; message: string }>('/whatsapp/send-document', payload);
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
