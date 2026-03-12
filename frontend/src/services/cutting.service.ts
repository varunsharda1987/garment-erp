import api from '../lib/api';
import type {
  CuttingBatch,
  CuttingBatchListResponse,
  CuttingBatchResponse,
  CuttingSummary,
  CuttingChartData,
  CreateCuttingBatchRequest,
  UpdateCuttingBatchRequest,
  RecordCuttingOutputRequest,
  CompleteCuttingBatchRequest,
  CuttingBatchQueryParams,
} from '../types/cutting.types';

const BASE_URL = '/cutting';

// ============================================
// Cutting Batch Service
// ============================================

export const cuttingBatchService = {
  // List all cutting batches with filters
  getAll: async (params?: CuttingBatchQueryParams): Promise<CuttingBatchListResponse> => {
    const response = await api.get<CuttingBatchListResponse>(`${BASE_URL}/batches`, { params });
    return response.data;
  },

  // Get single cutting batch by ID
  getById: async (id: string): Promise<CuttingBatch> => {
    const response = await api.get<CuttingBatchResponse>(`${BASE_URL}/batches/${id}`);
    return response.data.data;
  },

  // Create new cutting batch
  create: async (data: CreateCuttingBatchRequest): Promise<CuttingBatch> => {
    const response = await api.post<CuttingBatchResponse>(`${BASE_URL}/batches`, data);
    return response.data.data;
  },

  // Update cutting batch
  update: async (id: string, data: UpdateCuttingBatchRequest): Promise<CuttingBatch> => {
    const response = await api.put<CuttingBatchResponse>(`${BASE_URL}/batches/${id}`, data);
    return response.data.data;
  },

  // Delete cutting batch
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/batches/${id}`);
  },

  // ============================================
  // Workflow Actions
  // ============================================

  // Start cutting batch (PENDING -> IN_PROGRESS)
  start: async (id: string): Promise<CuttingBatch> => {
    const response = await api.post<CuttingBatchResponse>(`${BASE_URL}/batches/${id}/start`);
    return response.data.data;
  },

  // Record cutting output (update SKU quantities and defects)
  recordOutput: async (id: string, data: RecordCuttingOutputRequest): Promise<CuttingBatch> => {
    const response = await api.post<CuttingBatchResponse>(`${BASE_URL}/batches/${id}/record-output`, data);
    return response.data.data;
  },

  // Complete cutting batch (IN_PROGRESS -> COMPLETED)
  complete: async (id: string, data?: CompleteCuttingBatchRequest): Promise<CuttingBatch> => {
    const response = await api.post<CuttingBatchResponse>(`${BASE_URL}/batches/${id}/complete`, data);
    return response.data.data;
  },

  // Put cutting batch on hold (IN_PROGRESS -> ON_HOLD)
  hold: async (id: string, reason?: string): Promise<CuttingBatch> => {
    const response = await api.post<CuttingBatchResponse>(`${BASE_URL}/batches/${id}/hold`, { reason });
    return response.data.data;
  },

  // Resume cutting batch (ON_HOLD -> IN_PROGRESS)
  resume: async (id: string): Promise<CuttingBatch> => {
    const response = await api.post<CuttingBatchResponse>(`${BASE_URL}/batches/${id}/resume`);
    return response.data.data;
  },

  // Cancel cutting batch
  cancel: async (id: string, reason: string): Promise<CuttingBatch> => {
    const response = await api.post<CuttingBatchResponse>(`${BASE_URL}/batches/${id}/cancel`, { reason });
    return response.data.data;
  },

  // Generate transfer slip for completed batch
  generateTransferSlip: async (id: string): Promise<{ transferSlipId: string; slipNumber: string }> => {
    const response = await api.post<{ data: { transferSlipId: string; slipNumber: string } }>(
      `${BASE_URL}/batches/${id}/generate-transfer-slip`
    );
    return response.data.data;
  },
};

// ============================================
// Cutting Summary Service
// ============================================

export const cuttingSummaryService = {
  // Get overall cutting summary
  getSummary: async (): Promise<CuttingSummary> => {
    const response = await api.get<{ data: CuttingSummary }>(`${BASE_URL}/summary`);
    return response.data.data;
  },

  // Get summary by work order
  getSummaryByWorkOrder: async (workOrderId: string): Promise<CuttingSummary> => {
    const response = await api.get<{ data: CuttingSummary }>(`${BASE_URL}/summary/work-order/${workOrderId}`);
    return response.data.data;
  },

  // Get work orders available for cutting (with approved samples & fabric ready)
  getAvailableWorkOrders: async (): Promise<Array<{
    id: string;
    workOrderNumber: string;
    styleCode: string;
    styleName: string;
    styleId: string;
    orderQty: number;
    cutQty: number;
    pendingQty: number;
    fabricIds: string[];
    colors: Array<{ id: string; colorName: string }>;
    components: Array<{ id: string; componentName: string; componentCode: string }>;
  }>> => {
    const response = await api.get<{ data: Array<{
      id: string;
      workOrderNumber: string;
      styleCode: string;
      styleName: string;
      styleId: string;
      orderQty: number;
      cutQty: number;
      pendingQty: number;
      fabricIds: string[];
      colors: Array<{ id: string; colorName: string }>;
      components: Array<{ id: string; componentName: string; componentCode: string }>;
    }> }>(`${BASE_URL}/available-work-orders`);
    return response.data.data;
  },

  // Get fabric stock available for cutting
  getAvailableFabricStock: async (fabricId: string): Promise<Array<{
    id: string;
    rollNumbers?: string;
    quantityAvailable: number;
    finishedWidth: number;
    cutableWidth: number;
    qualityGrade: string;
    weightedAvgCost: number;
  }>> => {
    const response = await api.get<{ data: Array<{
      id: string;
      rollNumbers?: string;
      quantityAvailable: number;
      finishedWidth: number;
      cutableWidth: number;
      qualityGrade: string;
      weightedAvgCost: number;
    }> }>(`${BASE_URL}/available-fabric-stock/${fabricId}`);
    return response.data.data;
  },

  // Get cutting chart data for a work order (optionally filtered by color)
  getChartData: async (workOrderId: string, colorId?: string): Promise<CuttingChartData> => {
    const params = colorId ? { colorId } : {};
    const response = await api.get<{ data: CuttingChartData }>(`${BASE_URL}/chart-data/${workOrderId}`, { params });
    return response.data.data;
  },
};

export default {
  batch: cuttingBatchService,
  summary: cuttingSummaryService,
};
