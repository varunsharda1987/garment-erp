import api from '../lib/api';
import type {
  FinishingIssue,
  FinishingIssueListResponse,
  FinishingIssueResponse,
  FinishingSummary,
  FinishingIssueQueryParams,
  CreateFinishingIssueRequest,
  UpdateFinishingIssueRequest,
  RecordDailyOutputRequest,
  ReceiveFromStitchingRequest,
  FinishingStyleSizeSummaryItem,
  FinishingIncomingTransferSlip,
  PolybagEntryRequest,
  CartonPackingRequest,
} from '@/types/finishing.types';

const BASE_URL = '/finishing';

// ============================================
// Finishing Issue Service
// ============================================

export const finishingIssueService = {
  // List all issues with pagination and filters
  getAll: async (params: FinishingIssueQueryParams = {}): Promise<FinishingIssueListResponse> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.workOrderId) queryParams.append('workOrderId', params.workOrderId);
    if (params.managerId) queryParams.append('managerId', params.managerId);
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);

    const url = `${BASE_URL}/issues${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<FinishingIssueListResponse>(url);
    return response.data;
  },

  // Get single issue by ID
  getById: async (id: string): Promise<FinishingIssue> => {
    const response = await api.get<FinishingIssueResponse>(`${BASE_URL}/issues/${id}`);
    return response.data.data;
  },

  // Create new issue
  create: async (data: CreateFinishingIssueRequest): Promise<FinishingIssue> => {
    const response = await api.post<FinishingIssueResponse>(`${BASE_URL}/issues`, data);
    return response.data.data;
  },

  // Update issue
  update: async (id: string, data: UpdateFinishingIssueRequest): Promise<FinishingIssue> => {
    const response = await api.put<FinishingIssueResponse>(`${BASE_URL}/issues/${id}`, data);
    return response.data.data;
  },

  // Delete issue
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/issues/${id}`);
  },

  // ========================================
  // Workflow Actions
  // ========================================

  // Receive from stitching
  receive: async (id: string, data: ReceiveFromStitchingRequest): Promise<FinishingIssue> => {
    const response = await api.post<FinishingIssueResponse>(`${BASE_URL}/issues/${id}/receive`, data);
    return response.data.data;
  },

  // Start finishing
  start: async (id: string): Promise<FinishingIssue> => {
    const response = await api.post<FinishingIssueResponse>(`${BASE_URL}/issues/${id}/start`);
    return response.data.data;
  },

  // Record daily output
  recordOutput: async (id: string, data: RecordDailyOutputRequest): Promise<void> => {
    await api.post(`${BASE_URL}/issues/${id}/record-output`, data);
  },

  // Move to packing
  moveToPacking: async (id: string): Promise<FinishingIssue> => {
    const response = await api.post<FinishingIssueResponse>(`${BASE_URL}/issues/${id}/move-to-packing`);
    return response.data.data;
  },

  // Complete finishing
  complete: async (id: string): Promise<FinishingIssue> => {
    const response = await api.post<FinishingIssueResponse>(`${BASE_URL}/issues/${id}/complete`);
    return response.data.data;
  },

  // Generate transfer slip to dispatch
  generateTransferSlip: async (id: string): Promise<{ transferSlipId: string; slipNumber: string }> => {
    const response = await api.post<{ data: { transferSlipId: string; slipNumber: string } }>(
      `${BASE_URL}/issues/${id}/generate-transfer-slip`
    );
    return response.data.data;
  },

  // Record a polybag entry (packing stage)
  recordPolybagEntry: async (id: string, data: PolybagEntryRequest): Promise<void> => {
    await api.post(`${BASE_URL}/issues/${id}/polybag-entry`, data);
  },

  // Record a carton packing (packing stage) — feeds dispatch's available-cartons picker
  recordCartonPacking: async (id: string, data: CartonPackingRequest): Promise<void> => {
    await api.post(`${BASE_URL}/issues/${id}/carton-packing`, data);
  },
};

// ============================================
// Summary Service
// ============================================

export const finishingSummaryService = {
  // Get overall summary
  getSummary: async (): Promise<FinishingSummary> => {
    const response = await api.get<{ data: FinishingSummary }>(`${BASE_URL}/summary`);
    return response.data.data;
  },

  // Get summary by work order
  getSummaryByWorkOrder: async (workOrderId: string): Promise<FinishingSummary> => {
    const response = await api.get<{ data: FinishingSummary }>(`${BASE_URL}/summary/work-order/${workOrderId}`);
    return response.data.data;
  },

  // Get available transfer slips from stitching (with SKU breakdown)
  getAvailableTransferSlips: async (): Promise<FinishingIncomingTransferSlip[]> => {
    const response = await api.get<{ data: FinishingIncomingTransferSlip[] }>(`${BASE_URL}/available-transfer-slips`);
    return response.data.data;
  },

  // Get style/size-wise finishing summary with days tracking
  getStyleSizeSummary: async (): Promise<FinishingStyleSizeSummaryItem[]> => {
    const response = await api.get<{ data: FinishingStyleSizeSummaryItem[] }>(`${BASE_URL}/style-size-summary`);
    return response.data.data;
  },

  // Get available finishing contractors (suppliers with FINISHING_CONTRACTOR category)
  getAvailableManagers: async (): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      contactPerson: string | null;
      phone: string | null;
    }>
  > => {
    const response = await api.get<{
      data: Array<{ id: string; code: string; name: string; contactPerson: string | null; phone: string | null }>;
    }>(`${BASE_URL}/available-managers`);
    return response.data.data;
  },
};
