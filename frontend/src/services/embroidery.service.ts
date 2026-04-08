/**
 * Embroidery Service
 * API client for embroidery master management
 */

import api from '../lib/api';
import type {
  Embroidery,
  CreateEmbroideryRequest,
  UpdateEmbroideryRequest,
  EmbroideryListResponse,
  EmbroideryResponse,
  EmbroiderySearchResponse,
  EmbroiderySearchResult,
  EmbroideryQueryParams,
  EmbroiderySendOut,
  EmbroiderySendOutRequest,
  EmbroideryReceiveRequest,
  EmbroideredFabricStock,
  EmbroiderySendOutQueryParams,
  EmbroideryStockSummary,
} from '../types/embroidery.types';

export const embroideryService = {
  /**
   * Get all embroidery designs with pagination and filters
   */
  getAllEmbroidery: async (params?: EmbroideryQueryParams): Promise<EmbroideryListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.isActive !== undefined) {
      queryParams.append('isActive', params.isActive === 'all' ? 'all' : String(params.isActive));
    }

    const response = await api.get<EmbroideryListResponse>(`/embroidery?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get single embroidery design by ID
   */
  getEmbroideryById: async (id: string): Promise<Embroidery> => {
    const response = await api.get<EmbroideryResponse>(`/embroidery/${id}`);
    // API returns data directly, not nested under .data
    return response.data as unknown as Embroidery;
  },

  /**
   * Create new embroidery design
   */
  createEmbroidery: async (data: CreateEmbroideryRequest): Promise<Embroidery> => {
    const response = await api.post<EmbroideryResponse>('/embroidery', data);
    return response.data.data;
  },

  /**
   * Update embroidery design
   */
  updateEmbroidery: async (id: string, data: UpdateEmbroideryRequest): Promise<Embroidery> => {
    const response = await api.put<EmbroideryResponse>(`/embroidery/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete embroidery design
   */
  deleteEmbroidery: async (id: string): Promise<void> => {
    await api.delete(`/embroidery/${id}`);
  },

  /**
   * Search embroidery designs for picker/dropdown (minimal data)
   */
  searchEmbroidery: async (search?: string, limit?: number): Promise<EmbroiderySearchResult[]> => {
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (limit) queryParams.append('limit', limit.toString());

    const response = await api.get<EmbroiderySearchResponse>(`/embroidery/search?${queryParams.toString()}`);
    return response.data.data;
  },

  // ============================================
  // EMBROIDERY STOCK METHODS
  // ============================================

  /**
   * Send fabric out for embroidery
   */
  sendOut: async (data: EmbroiderySendOutRequest): Promise<EmbroiderySendOut> => {
    const response = await api.post<{ data: EmbroiderySendOut }>('/embroidery-stock/send-out', data);
    return response.data.data;
  },

  /**
   * Receive embroidered fabric back
   */
  receive: async (data: EmbroideryReceiveRequest): Promise<EmbroiderySendOut> => {
    const response = await api.post<{ data: EmbroiderySendOut }>('/embroidery-stock/receive', data);
    return response.data.data;
  },

  /**
   * Get all send-out records with filters
   */
  getSendOuts: async (params?: EmbroiderySendOutQueryParams): Promise<EmbroiderySendOut[]> => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.embroideryId) queryParams.append('embroideryId', params.embroideryId);
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.forStyleId) queryParams.append('forStyleId', params.forStyleId);
    if (params?.forOrderId) queryParams.append('forOrderId', params.forOrderId);
    if (params?.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params?.toDate) queryParams.append('toDate', params.toDate);

    const response = await api.get<{ data: EmbroiderySendOut[]; count: number }>(
      `/embroidery-stock/send-outs?${queryParams.toString()}`
    );
    return response.data.data;
  },

  /**
   * Get single send-out record by ID
   */
  getSendOutById: async (id: string): Promise<EmbroiderySendOut> => {
    const response = await api.get<{ data: EmbroiderySendOut }>(`/embroidery-stock/send-outs/${id}`);
    return response.data.data;
  },

  /**
   * Cancel a send-out
   */
  cancelSendOut: async (id: string, reason: string): Promise<EmbroiderySendOut> => {
    const response = await api.post<{ data: EmbroiderySendOut }>(`/embroidery-stock/send-outs/${id}/cancel`, {
      reason,
    });
    return response.data.data;
  },

  /**
   * Get embroidered stock for a specific style
   */
  getStockByStyle: async (styleId: string): Promise<EmbroideredFabricStock[]> => {
    const response = await api.get<{ data: EmbroideredFabricStock[]; count: number }>(
      `/embroidery-stock/by-style/${styleId}`
    );
    return response.data.data;
  },

  /**
   * Get stock by embroidery design
   */
  getStockByEmbroidery: async (embroideryId: string): Promise<EmbroideredFabricStock[]> => {
    const response = await api.get<{ data: EmbroideredFabricStock[]; count: number }>(
      `/embroidery-stock/by-embroidery/${embroideryId}`
    );
    return response.data.data;
  },

  /**
   * Get pending/overdue send-outs
   */
  getPendingSendOuts: async (): Promise<EmbroiderySendOut[]> => {
    const response = await api.get<{ data: EmbroiderySendOut[]; count: number }>('/embroidery-stock/pending');
    return response.data.data;
  },

  /**
   * Get embroidery stock summary
   */
  getStockSummary: async (): Promise<EmbroideryStockSummary> => {
    const response = await api.get<{ data: EmbroideryStockSummary }>('/embroidery-stock/summary');
    return response.data.data;
  },

  /**
   * Get fabric stock pending embroidery (needsEmbroidery=true)
   */
  getPendingEmbroideryStock: async (params?: { styleId?: string; page?: number; limit?: number }) => {
    const qp = new URLSearchParams();
    if (params?.styleId) qp.append('styleId', params.styleId);
    if (params?.page) qp.append('page', params.page.toString());
    if (params?.limit) qp.append('limit', params.limit.toString());
    const response = await api.get(`/embroidery-stock/pending-embroidery?${qp.toString()}`);
    return response.data;
  },
};

export default embroideryService;
