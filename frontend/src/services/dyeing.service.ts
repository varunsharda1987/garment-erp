import api from '@/lib/api';
import type {
  DyeLabDip,
  DyeLabDipListResponse,
  DyeLabDipResponse,
  CreateDyeLabDipRequest,
  UpdateDyeLabDipRequest,
  ApproveDyeLabDipRequest,
  RejectDyeLabDipRequest,
  DyeLabDipQueryParams,
  DyeJob,
  DyeJobListResponse,
  DyeJobResponse,
  CreateDyeJobRequest,
  SendToMillRequest,
  ReceiveFromMillRequest,
  QualityCheckRequest,
  DyeJobQueryParams,
  DyeingSummary,
} from '@/types/dyeing.types';

// ============================================
// Dye Lab Dip Service
// ============================================

export const dyeLabDipService = {
  // Get all lab dips for dyeing
  async getAllLabDips(params?: DyeLabDipQueryParams): Promise<DyeLabDipListResponse> {
    const response = await api.get<DyeLabDipListResponse>('/dyeing/lab-dips', {
      params: { ...params, processType: 'DYEING' },
    });
    return response.data;
  },

  // Get single lab dip by ID
  async getLabDipById(id: string): Promise<DyeLabDip> {
    const response = await api.get<DyeLabDipResponse>(`/dyeing/lab-dips/${id}`);
    return response.data.data;
  },

  // Create new lab dip
  async createLabDip(data: CreateDyeLabDipRequest): Promise<DyeLabDip> {
    const response = await api.post<DyeLabDipResponse>('/dyeing/lab-dips', {
      ...data,
      processType: 'DYEING',
    });
    return response.data.data;
  },

  // Update lab dip
  async updateLabDip(id: string, data: UpdateDyeLabDipRequest): Promise<DyeLabDip> {
    const response = await api.put<DyeLabDipResponse>(`/dyeing/lab-dips/${id}`, data);
    return response.data.data;
  },

  // Delete lab dip
  async deleteLabDip(id: string): Promise<void> {
    await api.delete(`/dyeing/lab-dips/${id}`);
  },

  // Approve lab dip
  async approveLabDip(id: string, data: ApproveDyeLabDipRequest): Promise<DyeLabDip> {
    const response = await api.post<DyeLabDipResponse>(`/dyeing/lab-dips/${id}/approve`, data);
    return response.data.data;
  },

  // Reject lab dip
  async rejectLabDip(id: string, data: RejectDyeLabDipRequest): Promise<DyeLabDip> {
    const response = await api.post<DyeLabDipResponse>(`/dyeing/lab-dips/${id}/reject`, data);
    return response.data.data;
  },

  // Mark for resubmission
  async requestResubmit(id: string, remarks?: string): Promise<DyeLabDip> {
    const response = await api.post<DyeLabDipResponse>(`/dyeing/lab-dips/${id}/resubmit`, { remarks });
    return response.data.data;
  },

  // Search lab dips
  async searchLabDips(query: string): Promise<DyeLabDip[]> {
    const response = await api.get<{ data: DyeLabDip[] }>('/dyeing/lab-dips/search', {
      params: { q: query, processType: 'DYEING' },
    });
    return response.data.data;
  },

  // Get approved lab dips (for creating dye jobs)
  async getApprovedLabDips(styleId?: string): Promise<DyeLabDip[]> {
    const response = await api.get<{ data: DyeLabDip[] }>('/dyeing/lab-dips/approved', {
      params: { processType: 'DYEING', styleId },
    });
    return response.data.data;
  },
};

// ============================================
// Dye Job Service
// ============================================

export const dyeJobService = {
  // Get all dye jobs
  async getAllDyeJobs(params?: DyeJobQueryParams): Promise<DyeJobListResponse> {
    const response = await api.get<DyeJobListResponse>('/dyeing/jobs', {
      params: { ...params, processType: 'DYEING' },
    });
    return response.data;
  },

  // Get single dye job by ID
  async getDyeJobById(id: string): Promise<DyeJob> {
    const response = await api.get<DyeJobResponse>(`/dyeing/jobs/${id}`);
    return response.data.data;
  },

  // Create new dye job
  async createDyeJob(data: CreateDyeJobRequest): Promise<DyeJob> {
    const response = await api.post<DyeJobResponse>('/dyeing/jobs', {
      ...data,
      processType: 'DYEING',
    });
    return response.data.data;
  },

  // Update dye job
  async updateDyeJob(id: string, data: Partial<CreateDyeJobRequest>): Promise<DyeJob> {
    const response = await api.put<DyeJobResponse>(`/dyeing/jobs/${id}`, data);
    return response.data.data;
  },

  // Delete dye job
  async deleteDyeJob(id: string): Promise<void> {
    await api.delete(`/dyeing/jobs/${id}`);
  },

  // Send fabric to mill
  async sendToMill(id: string, data: SendToMillRequest): Promise<DyeJob> {
    const response = await api.post<DyeJobResponse>(`/dyeing/jobs/${id}/send`, data);
    return response.data.data;
  },

  // Receive fabric from mill
  async receiveFromMill(id: string, data: ReceiveFromMillRequest): Promise<DyeJob> {
    const response = await api.post<DyeJobResponse>(`/dyeing/jobs/${id}/receive`, data);
    return response.data.data;
  },

  // Record quality check
  async qualityCheck(id: string, data: QualityCheckRequest): Promise<DyeJob> {
    const response = await api.post<DyeJobResponse>(`/dyeing/jobs/${id}/quality-check`, data);
    return response.data.data;
  },

  // Update stock after quality check
  async updateStock(id: string): Promise<DyeJob> {
    const response = await api.post<DyeJobResponse>(`/dyeing/jobs/${id}/update-stock`);
    return response.data.data;
  },

  // Get jobs by status
  async getJobsByStatus(status: string): Promise<DyeJob[]> {
    const response = await api.get<{ data: DyeJob[] }>('/dyeing/jobs', {
      params: { processType: 'DYEING', status },
    });
    return response.data.data;
  },

  // Get jobs at mill
  async getJobsAtMill(): Promise<DyeJob[]> {
    return this.getJobsByStatus('AT_MILL');
  },

  // Get jobs ready to send
  async getJobsReadyToSend(): Promise<DyeJob[]> {
    return this.getJobsByStatus('READY_TO_SEND');
  },
};

// ============================================
// Dyeing Summary Service
// ============================================

export const dyeingSummaryService = {
  // Get dyeing summary
  async getSummary(): Promise<DyeingSummary> {
    const response = await api.get<{ data: DyeingSummary }>('/dyeing/summary');
    return response.data.data;
  },

  // Get summary by style
  async getSummaryByStyle(styleId: string): Promise<DyeingSummary> {
    const response = await api.get<{ data: DyeingSummary }>(`/dyeing/summary/style/${styleId}`);
    return response.data.data;
  },

  // Get summary by mill
  async getSummaryByMill(millId: string): Promise<DyeingSummary> {
    const response = await api.get<{ data: DyeingSummary }>(`/dyeing/summary/mill/${millId}`);
    return response.data.data;
  },
};

// Export combined service
export const dyeingService = {
  labDips: dyeLabDipService,
  jobs: dyeJobService,
  summary: dyeingSummaryService,
};

export default dyeingService;
