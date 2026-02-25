// Processing Batch Service - API calls for job work processing
import api from '@/lib/api';
import type {
  ProcessingBatch,
  CreateProcessingBatchDTO,
  UpdateProcessingBatchDTO,
  ProcessingBatchFilters,
  JobWorkSummary,
  ApiResponse,
  ReceiveProcessedLaceDTO,
  ReceiveProcessedLaceResponse,
  LaceProcessingSummary,
} from '@/types/processing.types';

class ProcessingBatchService {
  private basePath = '/processing-batches';

  /**
   * Get all processing batches
   */
  async getAll(filters?: ProcessingBatchFilters): Promise<ProcessingBatch[]> {
    const params = new URLSearchParams();
    if (filters?.overallStatus) params.append('overallStatus', filters.overallStatus);
    if (filters?.materialType) params.append('materialType', filters.materialType);
    if (filters?.greigeId) params.append('greigeId', filters.greigeId);
    if (filters?.fabricId) params.append('fabricId', filters.fabricId);
    if (filters?.laceId) params.append('laceId', filters.laceId);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString();
    const url = query ? `${this.basePath}?${query}` : this.basePath;

    const response = await api.get<ApiResponse<ProcessingBatch[]>>(url);
    return response.data.data || [];
  }

  /**
   * Get batch by ID
   */
  async getById(id: string): Promise<ProcessingBatch> {
    const response = await api.get<ApiResponse<ProcessingBatch>>(
      `${this.basePath}/${id}`
    );
    if (!response.data.data) {
      throw new Error('Batch not found');
    }
    return response.data.data;
  }

  /**
   * Create new processing batch
   */
  async create(data: CreateProcessingBatchDTO): Promise<ProcessingBatch> {
    const response = await api.post<ApiResponse<ProcessingBatch>>(
      this.basePath,
      data
    );
    if (!response.data.data) {
      throw new Error('Failed to create batch');
    }
    return response.data.data;
  }

  /**
   * Update processing batch
   */
  async update(
    id: string,
    data: UpdateProcessingBatchDTO
  ): Promise<ProcessingBatch> {
    const response = await api.put<ApiResponse<ProcessingBatch>>(
      `${this.basePath}/${id}`,
      data
    );
    if (!response.data.data) {
      throw new Error('Failed to update batch');
    }
    return response.data.data;
  }

  /**
   * Get batches by processor
   */
  async getByProcessor(processorId: string): Promise<ProcessingBatch[]> {
    const response = await api.get<ApiResponse<ProcessingBatch[]>>(
      `${this.basePath}/processor/${processorId}`
    );
    return response.data.data || [];
  }

  /**
   * Get job work summary
   */
  async getJobWorkSummary(): Promise<JobWorkSummary> {
    const response = await api.get<ApiResponse<JobWorkSummary>>(
      `${this.basePath}/summary/job-work`
    );
    if (!response.data.data) {
      throw new Error('Failed to fetch job work summary');
    }
    return response.data.data;
  }

  /**
   * Cancel batch
   */
  async cancel(id: string): Promise<ProcessingBatch> {
    const response = await api.post<ApiResponse<ProcessingBatch>>(
      `${this.basePath}/${id}/cancel`
    );
    if (!response.data.data) {
      throw new Error('Failed to cancel batch');
    }
    return response.data.data;
  }

  /**
   * Complete batch
   */
  async complete(id: string): Promise<ProcessingBatch> {
    const response = await api.post<ApiResponse<ProcessingBatch>>(
      `${this.basePath}/${id}/complete`
    );
    if (!response.data.data) {
      throw new Error('Failed to complete batch');
    }
    return response.data.data;
  }

  /**
   * Receive processed lace (creates finished stock)
   */
  async receiveProcessedLace(
    batchId: string,
    data: ReceiveProcessedLaceDTO
  ): Promise<ReceiveProcessedLaceResponse> {
    const response = await api.post<ApiResponse<ReceiveProcessedLaceResponse>>(
      `${this.basePath}/${batchId}/receive-lace`,
      data
    );
    if (!response.data.data) {
      throw new Error('Failed to receive processed lace');
    }
    return response.data.data;
  }

  /**
   * Get lace processing summary
   */
  async getLaceProcessingSummary(): Promise<LaceProcessingSummary> {
    const response = await api.get<ApiResponse<LaceProcessingSummary>>(
      `${this.basePath}/summary/lace`
    );
    if (!response.data.data) {
      throw new Error('Failed to fetch lace processing summary');
    }
    return response.data.data;
  }
}

export default new ProcessingBatchService();
