import api from '../lib/api';
import type {
  StitchingIssue,
  StitchingIssueListResponse,
  StitchingIssueResponse,
  StitchingSummary,
  CreateStitchingIssueRequest,
  UpdateStitchingIssueRequest,
  RecordDailyOutputRequest,
  ReceiveFromCuttingRequest,
  StitchingIssueQueryParams,
  StitchingDailyOutput,
  StyleSizeSummaryItem,
  IncomingTransferSlip,
} from '../types/stitching.types';

const BASE_URL = '/stitching';

// ============================================
// Stitching Issue Service
// ============================================

export const stitchingIssueService = {
  // List all stitching issues with filters
  getAll: async (params?: StitchingIssueQueryParams): Promise<StitchingIssueListResponse> => {
    const response = await api.get<StitchingIssueListResponse>(`${BASE_URL}/issues`, { params });
    return response.data;
  },

  // Get single stitching issue by ID
  getById: async (id: string): Promise<StitchingIssue> => {
    const response = await api.get<StitchingIssueResponse>(`${BASE_URL}/issues/${id}`);
    return response.data.data;
  },

  // Create new stitching issue
  create: async (data: CreateStitchingIssueRequest): Promise<StitchingIssue> => {
    const response = await api.post<StitchingIssueResponse>(`${BASE_URL}/issues`, data);
    return response.data.data;
  },

  // Update stitching issue
  update: async (id: string, data: UpdateStitchingIssueRequest): Promise<StitchingIssue> => {
    const response = await api.put<StitchingIssueResponse>(`${BASE_URL}/issues/${id}`, data);
    return response.data.data;
  },

  // Delete stitching issue
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/issues/${id}`);
  },

  // ============================================
  // Workflow Actions
  // ============================================

  // Receive from cutting (PENDING_RECEIPT -> RECEIVED)
  receiveFromCutting: async (id: string, data: ReceiveFromCuttingRequest): Promise<StitchingIssue> => {
    const response = await api.post<StitchingIssueResponse>(`${BASE_URL}/issues/${id}/receive`, data);
    return response.data.data;
  },

  // Start stitching (RECEIVED -> IN_PROGRESS)
  start: async (id: string): Promise<StitchingIssue> => {
    const response = await api.post<StitchingIssueResponse>(`${BASE_URL}/issues/${id}/start`);
    return response.data.data;
  },

  // Record daily output
  recordDailyOutput: async (id: string, data: RecordDailyOutputRequest): Promise<StitchingDailyOutput> => {
    const response = await api.post<{ data: StitchingDailyOutput }>(`${BASE_URL}/issues/${id}/daily-output`, data);
    return response.data.data;
  },

  // Complete stitching issue (IN_PROGRESS -> COMPLETED)
  complete: async (id: string): Promise<StitchingIssue> => {
    const response = await api.post<StitchingIssueResponse>(`${BASE_URL}/issues/${id}/complete`);
    return response.data.data;
  },

  // Reopen a completed issue (COMPLETED -> IN_PROGRESS)
  reopen: async (id: string): Promise<StitchingIssue> => {
    const response = await api.post<StitchingIssueResponse>(`${BASE_URL}/issues/${id}/reopen`);
    return response.data.data;
  },

  // Generate transfer slip to finishing
  generateTransferSlip: async (id: string): Promise<{ transferSlipId: string; slipNumber: string }> => {
    const response = await api.post<{ data: { transferSlipId: string; slipNumber: string } }>(
      `${BASE_URL}/issues/${id}/generate-transfer-slip`
    );
    return response.data.data;
  },
};

// ============================================
// Stitching Summary Service
// ============================================

export const stitchingSummaryService = {
  // Get overall stitching summary
  getSummary: async (): Promise<StitchingSummary> => {
    const response = await api.get<{ data: StitchingSummary }>(`${BASE_URL}/summary`);
    return response.data.data;
  },

  // Get summary by work order
  getSummaryByWorkOrder: async (workOrderId: string): Promise<StitchingSummary> => {
    const response = await api.get<{ data: StitchingSummary }>(`${BASE_URL}/summary/work-order/${workOrderId}`);
    return response.data.data;
  },

  // Get summary by manager
  getSummaryByManager: async (managerId: string): Promise<StitchingSummary> => {
    const response = await api.get<{ data: StitchingSummary }>(`${BASE_URL}/summary/manager/${managerId}`);
    return response.data.data;
  },

  // Get pending transfer slips from cutting
  getPendingTransferSlips: async (): Promise<IncomingTransferSlip[]> => {
    const response = await api.get<{ data: IncomingTransferSlip[] }>(`${BASE_URL}/pending-transfer-slips`);
    return response.data.data;
  },

  // Get style/size-wise summary across all active issues
  getStyleSizeSummary: async (): Promise<StyleSizeSummaryItem[]> => {
    const response = await api.get<{ data: StyleSizeSummaryItem[] }>(`${BASE_URL}/style-size-summary`);
    return response.data.data;
  },

  // Get available stitching contractors (suppliers with STITCHING_CONTRACTOR category)
  getAvailableManagers: async (): Promise<
    Array<{ id: string; code: string; name: string; contactPerson: string | null; phone: string | null }>
  > => {
    const response = await api.get<{
      data: Array<{ id: string; code: string; name: string; contactPerson: string | null; phone: string | null }>;
    }>(`${BASE_URL}/available-managers`);
    return response.data.data;
  },
};

export default {
  issue: stitchingIssueService,
  summary: stitchingSummaryService,
};
