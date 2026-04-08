/**
 * External Process Service
 * API client for Smocking, Handwork, and Piece-Level Embroidery tracking
 */

import api from '../lib/api';
import type {
  ExternalProcessSendOut,
  CreateExternalProcessSendOutRequest,
  ExternalProcessReceiveRequest,
  ExternalProcessQueryParams,
  ExternalProcessDashboard,
  PaginatedExternalProcessSendOuts,
  ExternalProcessType,
} from '../types/external-process.types';

const BASE_URL = '/external-process';

export const externalProcessService = {
  /**
   * Create a send-out record
   */
  createSendOut: async (data: CreateExternalProcessSendOutRequest): Promise<ExternalProcessSendOut> => {
    const response = await api.post(`${BASE_URL}/send-out`, data);
    return response.data.data;
  },

  /**
   * Record receipt of material
   */
  receive: async (data: ExternalProcessReceiveRequest): Promise<ExternalProcessSendOut> => {
    const response = await api.post(`${BASE_URL}/receive`, data);
    return response.data.data;
  },

  /**
   * Get all send-outs with filters and pagination
   */
  getSendOuts: async (params?: ExternalProcessQueryParams): Promise<PaginatedExternalProcessSendOuts> => {
    const queryParams = new URLSearchParams();
    if (params?.processType) queryParams.append('processType', params.processType);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.workOrderId) queryParams.append('workOrderId', params.workOrderId);
    if (params?.orderId) queryParams.append('orderId', params.orderId);
    if (params?.styleId) queryParams.append('styleId', params.styleId);
    if (params?.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params?.toDate) queryParams.append('toDate', params.toDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);

    const response = await api.get(`${BASE_URL}/send-outs?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get single send-out by ID
   */
  getSendOutById: async (id: string): Promise<ExternalProcessSendOut> => {
    const response = await api.get(`${BASE_URL}/send-outs/${id}`);
    return response.data;
  },

  /**
   * Cancel a send-out
   */
  cancelSendOut: async (id: string, reason: string): Promise<ExternalProcessSendOut> => {
    const response = await api.post(`${BASE_URL}/send-outs/${id}/cancel`, { reason });
    return response.data.data;
  },

  /**
   * Get WIP dashboard data
   */
  getDashboard: async (processType: ExternalProcessType): Promise<ExternalProcessDashboard> => {
    const response = await api.get(`${BASE_URL}/dashboard?processType=${processType}`);
    return response.data;
  },

  /**
   * Get WIP for a specific work order
   */
  getWipByWorkOrder: async (
    workOrderId: string,
    processType?: ExternalProcessType
  ): Promise<ExternalProcessSendOut[]> => {
    const params = processType ? `?processType=${processType}` : '';
    const response = await api.get(`${BASE_URL}/wip/${workOrderId}${params}`);
    return response.data;
  },
};
