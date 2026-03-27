import api from '@/lib/api';
import type {
  LabDip,
  LabDipListResponse,
  LabDipResponse,
  CreateLabDipRequest,
  UpdateLabDipRequest,
  ApproveLabDipRequest,
  RejectLabDipRequest,
  LabDipQueryParams,
  JobWorkOrder,
  JobWorkOrderListResponse,
  JobWorkOrderResponse,
  CreateJobWorkOrderRequest,
  SendToMillRequest,
  ReceiveFromMillRequest,
  QualityCheckRequest,
  JobWorkOrderQueryParams,
  PrintingSummary,
  ProcessPO,
  ProcessPOListResponse,
  CreateProcessPORequest,
  ProcessPOQueryParams,
} from '@/types/printing.types';

// ============================================
// Lab Dip Service
// ============================================

export const labDipService = {
  // Get all lab dips for printing
  async getAllLabDips(params?: LabDipQueryParams): Promise<LabDipListResponse> {
    const response = await api.get<LabDipListResponse>('/printing/lab-dips', {
      params: { ...params, processType: 'PRINTING' },
    });
    return response.data;
  },

  // Get single lab dip by ID
  async getLabDipById(id: string): Promise<LabDip> {
    const response = await api.get<LabDipResponse>(`/printing/lab-dips/${id}`);
    return response.data.data;
  },

  // Create new lab dip
  async createLabDip(data: CreateLabDipRequest): Promise<LabDip> {
    const response = await api.post<LabDipResponse>('/printing/lab-dips', {
      ...data,
      processType: 'PRINTING',
    });
    return response.data.data;
  },

  // Update lab dip
  async updateLabDip(id: string, data: UpdateLabDipRequest): Promise<LabDip> {
    const response = await api.put<LabDipResponse>(`/printing/lab-dips/${id}`, data);
    return response.data.data;
  },

  // Delete lab dip
  async deleteLabDip(id: string): Promise<void> {
    await api.delete(`/printing/lab-dips/${id}`);
  },

  // Approve lab dip
  async approveLabDip(id: string, data: ApproveLabDipRequest): Promise<LabDip> {
    const response = await api.post<LabDipResponse>(`/printing/lab-dips/${id}/approve`, data);
    return response.data.data;
  },

  // Reject lab dip
  async rejectLabDip(id: string, data: RejectLabDipRequest): Promise<LabDip> {
    const response = await api.post<LabDipResponse>(`/printing/lab-dips/${id}/reject`, data);
    return response.data.data;
  },

  // Mark for resubmission
  async requestResubmit(id: string, remarks?: string): Promise<LabDip> {
    const response = await api.post<LabDipResponse>(`/printing/lab-dips/${id}/resubmit`, { remarks });
    return response.data.data;
  },

  // Search lab dips
  async searchLabDips(query: string): Promise<LabDip[]> {
    const response = await api.get<{ data: LabDip[] }>('/printing/lab-dips/search', {
      params: { q: query, processType: 'PRINTING' },
    });
    return response.data.data;
  },

  // Get approved lab dips (for creating job work orders)
  async getApprovedLabDips(styleId?: string): Promise<LabDip[]> {
    const response = await api.get<{ data: LabDip[] }>('/printing/lab-dips/approved', {
      params: { processType: 'PRINTING', styleId },
    });
    return response.data.data;
  },
};

// ============================================
// Print Job (Job Work Order) Service
// ============================================

export const printJobService = {
  // Get all print jobs
  async getAllPrintJobs(params?: JobWorkOrderQueryParams): Promise<JobWorkOrderListResponse> {
    const response = await api.get<JobWorkOrderListResponse>('/printing/jobs', {
      params: { ...params, processType: 'PRINTING' },
    });
    return response.data;
  },

  // Get single print job by ID
  async getPrintJobById(id: string): Promise<JobWorkOrder> {
    const response = await api.get<JobWorkOrderResponse>(`/printing/jobs/${id}`);
    return response.data.data;
  },

  // Create new print job
  async createPrintJob(data: CreateJobWorkOrderRequest): Promise<JobWorkOrder> {
    const response = await api.post<JobWorkOrderResponse>('/printing/jobs', {
      ...data,
      processType: 'PRINTING',
    });
    return response.data.data;
  },

  // Update print job
  async updatePrintJob(id: string, data: Partial<CreateJobWorkOrderRequest>): Promise<JobWorkOrder> {
    const response = await api.put<JobWorkOrderResponse>(`/printing/jobs/${id}`, data);
    return response.data.data;
  },

  // Delete print job
  async deletePrintJob(id: string): Promise<void> {
    await api.delete(`/printing/jobs/${id}`);
  },

  // Send fabric to mill
  async sendToMill(id: string, data: SendToMillRequest): Promise<JobWorkOrder> {
    const response = await api.post<JobWorkOrderResponse>(`/printing/jobs/${id}/send`, data);
    return response.data.data;
  },

  // Receive fabric from mill
  async receiveFromMill(id: string, data: ReceiveFromMillRequest): Promise<JobWorkOrder> {
    const response = await api.post<JobWorkOrderResponse>(`/printing/jobs/${id}/receive`, data);
    return response.data.data;
  },

  // Record quality check
  async qualityCheck(id: string, data: QualityCheckRequest): Promise<JobWorkOrder> {
    const response = await api.post<JobWorkOrderResponse>(`/printing/jobs/${id}/quality-check`, data);
    return response.data.data;
  },

  // Update stock after quality check
  async updateStock(id: string): Promise<JobWorkOrder> {
    const response = await api.post<JobWorkOrderResponse>(`/printing/jobs/${id}/update-stock`);
    return response.data.data;
  },

  // Get jobs by status
  async getJobsByStatus(status: string): Promise<JobWorkOrder[]> {
    const response = await api.get<{ data: JobWorkOrder[] }>('/printing/jobs', {
      params: { processType: 'PRINTING', status },
    });
    return response.data.data;
  },

  // Get jobs at mill
  async getJobsAtMill(): Promise<JobWorkOrder[]> {
    return this.getJobsByStatus('AT_MILL');
  },

  // Get jobs ready to send
  async getJobsReadyToSend(): Promise<JobWorkOrder[]> {
    return this.getJobsByStatus('READY_TO_SEND');
  },
};

// ============================================
// Printing Summary Service
// ============================================

export const printingSummaryService = {
  // Get printing summary
  async getSummary(): Promise<PrintingSummary> {
    const response = await api.get<{ data: PrintingSummary }>('/printing/summary');
    return response.data.data;
  },

  // Get summary by style
  async getSummaryByStyle(styleId: string): Promise<PrintingSummary> {
    const response = await api.get<{ data: PrintingSummary }>(`/printing/summary/style/${styleId}`);
    return response.data.data;
  },

  // Get summary by mill
  async getSummaryByMill(millId: string): Promise<PrintingSummary> {
    const response = await api.get<{ data: PrintingSummary }>(`/printing/summary/mill/${millId}`);
    return response.data.data;
  },
};

// ============================================
// Process PO Service
// ============================================

export const processPOService = {
  async getAll(params?: ProcessPOQueryParams): Promise<ProcessPOListResponse> {
    const response = await api.get<ProcessPOListResponse>('/printing/process-pos', { params });
    return response.data;
  },
  async getById(id: string): Promise<ProcessPO> {
    const response = await api.get<{ data: ProcessPO }>(`/printing/process-pos/${id}`);
    return response.data.data;
  },
  async create(data: CreateProcessPORequest): Promise<ProcessPO> {
    const response = await api.post<{ data: ProcessPO }>('/printing/process-pos', data);
    return response.data.data;
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/printing/process-pos/${id}`);
  },
  async sendToMill(
    id: string,
    data: { sentDate: string; challanNumber?: string; vehicleNumber?: string }
  ): Promise<ProcessPO> {
    const response = await api.post<{ data: ProcessPO }>(`/printing/process-pos/${id}/send`, data);
    return response.data.data;
  },
  async receiveFromMill(id: string, data: ReceiveFromMillRequest): Promise<ProcessPO> {
    const response = await api.post<{ data: ProcessPO }>(`/printing/process-pos/${id}/receive`, data);
    return response.data.data;
  },
  async qualityCheck(id: string, data: QualityCheckRequest): Promise<ProcessPO> {
    const response = await api.post<{ data: ProcessPO }>(`/printing/process-pos/${id}/quality-check`, data);
    return response.data.data;
  },
  async updateStock(id: string): Promise<ProcessPO> {
    const response = await api.post<{ data: ProcessPO }>(`/printing/process-pos/${id}/update-stock`);
    return response.data.data;
  },
  async returnUnprocessed(
    id: string,
    data: { returnedQtyMeters: number; returnDate: string; remarks?: string }
  ): Promise<ProcessPO> {
    const response = await api.post<{ data: ProcessPO }>(`/printing/process-pos/${id}/return-unprocessed`, data);
    return response.data.data;
  },
};

// Export combined service
export const printingService = {
  labDips: labDipService,
  jobs: printJobService,
  processPOs: processPOService,
  summary: printingSummaryService,
};

export default printingService;
