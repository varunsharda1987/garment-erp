import api from '../lib/api';
import type {
  DeliveryNote,
  DeliveryNoteListResponse,
  ASNApplication,
  ASNListResponse,
  DispatchSummary,
  DeliveryNoteQueryParams,
  ASNQueryParams,
  CreateASNRequest,
  ApproveASNRequest,
  CreateDeliveryNoteRequest,
  AssignTransportRequest,
  RecordPODRequest,
} from '@/types/dispatch.types';

const BASE_URL = '/dispatch';

// ============================================
// Delivery Note Service
// ============================================

export const deliveryNoteService = {
  // List all delivery notes with pagination and filters
  getAll: async (params: DeliveryNoteQueryParams = {}): Promise<DeliveryNoteListResponse> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.orderId) queryParams.append('orderId', params.orderId);
    if (params.customerId) queryParams.append('customerId', params.customerId);
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);

    const url = `${BASE_URL}/delivery-notes${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<DeliveryNoteListResponse>(url);
    return response.data;
  },

  // Get single delivery note by ID
  getById: async (id: string): Promise<DeliveryNote> => {
    const response = await api.get<{ data: DeliveryNote }>(`${BASE_URL}/delivery-notes/${id}`);
    return response.data.data;
  },

  // Create new delivery note. The backend flags SKUs whose finished-goods stock couldn't cover the
  // dispatched quantity (fgShortfalls) — callers MUST surface these to the user (never silent).
  create: async (
    data: CreateDeliveryNoteRequest
  ): Promise<{
    note: DeliveryNote;
    fgShortfalls?: Array<{
      styleId: string;
      colorId: string | null;
      sizeId: string;
      requested: number;
      deducted: number;
    }>;
    message?: string;
  }> => {
    const response = await api.post<{
      data: DeliveryNote;
      fgShortfalls?: Array<{
        styleId: string;
        colorId: string | null;
        sizeId: string;
        requested: number;
        deducted: number;
      }>;
      message?: string;
    }>(`${BASE_URL}/delivery-notes`, data);
    return { note: response.data.data, fgShortfalls: response.data.fgShortfalls, message: response.data.message };
  },

  // Delete delivery note
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/delivery-notes/${id}`);
  },

  // ========================================
  // Workflow Actions
  // ========================================

  // Assign transport
  assignTransport: async (id: string, data: AssignTransportRequest): Promise<void> => {
    await api.post(`${BASE_URL}/delivery-notes/${id}/assign-transport`, data);
  },

  // Mark as dispatched (in transit)
  dispatch: async (id: string): Promise<DeliveryNote> => {
    const response = await api.post<{ data: DeliveryNote }>(`${BASE_URL}/delivery-notes/${id}/dispatch`);
    return response.data.data;
  },

  // Record POD (Proof of Delivery)
  recordPOD: async (id: string, data: RecordPODRequest): Promise<void> => {
    await api.post(`${BASE_URL}/delivery-notes/${id}/record-pod`, data);
  },
};

// ============================================
// ASN Application Service
// ============================================

export const asnService = {
  // List all ASN applications
  getAll: async (params: ASNQueryParams = {}): Promise<ASNListResponse> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.orderId) queryParams.append('orderId', params.orderId);
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);

    const url = `${BASE_URL}/asn${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<ASNListResponse>(url);
    return response.data;
  },

  // Get single ASN by ID
  getById: async (id: string): Promise<ASNApplication> => {
    const response = await api.get<{ data: ASNApplication }>(`${BASE_URL}/asn/${id}`);
    return response.data.data;
  },

  // Create new ASN application
  create: async (data: CreateASNRequest): Promise<ASNApplication> => {
    const response = await api.post<{ data: ASNApplication }>(`${BASE_URL}/asn`, data);
    return response.data.data;
  },

  // Apply ASN (submit to buyer)
  apply: async (id: string): Promise<ASNApplication> => {
    const response = await api.post<{ data: ASNApplication }>(`${BASE_URL}/asn/${id}/apply`);
    return response.data.data;
  },

  // Approve ASN
  approve: async (id: string, data: ApproveASNRequest): Promise<ASNApplication> => {
    const response = await api.post<{ data: ASNApplication }>(`${BASE_URL}/asn/${id}/approve`, data);
    return response.data.data;
  },

  // Reject ASN
  reject: async (id: string, reason: string): Promise<ASNApplication> => {
    const response = await api.post<{ data: ASNApplication }>(`${BASE_URL}/asn/${id}/reject`, {
      rejectionReason: reason,
    });
    return response.data.data;
  },

  // Reschedule ASN
  reschedule: async (id: string, rescheduleDate: string): Promise<ASNApplication> => {
    const response = await api.post<{ data: ASNApplication }>(`${BASE_URL}/asn/${id}/reschedule`, {
      rescheduleDate,
    });
    return response.data.data;
  },

  // Delete ASN (only pending)
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/asn/${id}`);
  },
};

// ============================================
// Summary Service
// ============================================

export const dispatchSummaryService = {
  // Get overall summary
  getSummary: async (): Promise<DispatchSummary> => {
    const response = await api.get<{ data: DispatchSummary }>(`${BASE_URL}/summary`);
    return response.data.data;
  },

  // Get available cartons for dispatch (packed but not dispatched)
  getAvailableCartons: async (
    orderId?: string
  ): Promise<
    Array<{
      id: string;
      cartonNumber: string;
      workOrderNumber: string;
      styleName: string;
      totalPieces: number;
      packedDate: string;
    }>
  > => {
    const url = orderId ? `${BASE_URL}/available-cartons?orderId=${orderId}` : `${BASE_URL}/available-cartons`;
    const response = await api.get<{
      data: Array<{
        id: string;
        cartonNumber: string;
        workOrderNumber: string;
        styleName: string;
        totalPieces: number;
        packedDate: string;
      }>;
    }>(url);
    return response.data.data;
  },

  // Get orders ready for dispatch
  getOrdersReadyForDispatch: async (): Promise<
    Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      totalPieces: number;
      packedPieces: number;
      dispatchedPieces: number;
    }>
  > => {
    const response = await api.get<{
      data: Array<{
        id: string;
        orderNumber: string;
        customerName: string;
        totalPieces: number;
        packedPieces: number;
        dispatchedPieces: number;
      }>;
    }>(`${BASE_URL}/orders-ready`);
    return response.data.data;
  },
};
