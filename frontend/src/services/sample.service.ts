/**
 * Sample Service
 * API interactions for sample tracking management
 */

import api from '../lib/api';
import type {
  Sample,
  SampleListResponse,
  SampleResponse,
  SampleQueryParams,
  CreateSampleRequest,
  UpdateSampleRequest,
  UpdateSampleStatusRequest,
  SampleSummary,
  SampleMeasurementInput,
  SampleColorwayInput,
  SampleSizeSetInput,
} from '../types/sample.types';

const BASE_URL = '/samples';

export const sampleService = {
  // ============================================
  // SAMPLE CRUD OPERATIONS
  // ============================================

  /**
   * Get all samples with pagination and filtering
   */
  getAllSamples: async (params: SampleQueryParams = {}): Promise<SampleListResponse> => {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.customerId) queryParams.append('customerId', params.customerId);
    if (params.styleId) queryParams.append('styleId', params.styleId);
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);
    if (params.pendingApproval) queryParams.append('pendingApproval', 'true');

    // Handle array parameters
    if (params.sampleType) {
      const types = Array.isArray(params.sampleType) ? params.sampleType : [params.sampleType];
      types.forEach((t) => queryParams.append('sampleType', t));
    }

    if (params.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status];
      statuses.forEach((s) => queryParams.append('status', s));
    }

    const url = `${BASE_URL}?${queryParams.toString()}`;
    const response = await api.get<SampleListResponse>(url);
    return response.data;
  },

  /**
   * Get sample by ID with all related data
   */
  getSampleById: async (id: string): Promise<Sample> => {
    const response = await api.get<SampleResponse>(`${BASE_URL}/${id}`);
    return response.data.data;
  },

  /**
   * Create a new sample
   */
  createSample: async (data: CreateSampleRequest): Promise<Sample> => {
    const response = await api.post<SampleResponse>(BASE_URL, data);
    return response.data.data;
  },

  /**
   * Update sample
   */
  updateSample: async (id: string, data: UpdateSampleRequest): Promise<Sample> => {
    const response = await api.put<SampleResponse>(`${BASE_URL}/${id}`, data);
    return response.data.data;
  },

  /**
   * Update sample status (with feedback)
   */
  updateSampleStatus: async (id: string, data: UpdateSampleStatusRequest): Promise<Sample> => {
    const response = await api.patch<SampleResponse>(`${BASE_URL}/${id}/status`, data);
    return response.data.data;
  },

  /**
   * Delete sample
   */
  deleteSample: async (id: string): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`);
  },

  // ============================================
  // MEASUREMENTS
  // ============================================

  /**
   * Add or update measurements for a sample
   */
  updateMeasurements: async (
    sampleId: string,
    measurements: SampleMeasurementInput[]
  ): Promise<Sample> => {
    const response = await api.put<SampleResponse>(
      `${BASE_URL}/${sampleId}/measurements`,
      { measurements }
    );
    return response.data.data;
  },

  /**
   * Record actual measurements (for QC)
   */
  recordActualMeasurements: async (
    sampleId: string,
    measurements: Array<{ id: string; actualValue: number }>
  ): Promise<Sample> => {
    const response = await api.patch<SampleResponse>(
      `${BASE_URL}/${sampleId}/measurements/actual`,
      { measurements }
    );
    return response.data.data;
  },

  // ============================================
  // COLORWAYS (PP Samples)
  // ============================================

  /**
   * Add or update colorways for a PP sample
   */
  updateColorways: async (
    sampleId: string,
    colorways: SampleColorwayInput[]
  ): Promise<Sample> => {
    const response = await api.put<SampleResponse>(
      `${BASE_URL}/${sampleId}/colorways`,
      { colorways }
    );
    return response.data.data;
  },

  /**
   * Update colorway status (approve/reject individual colorway)
   */
  updateColorwayStatus: async (
    sampleId: string,
    colorwayId: string,
    status: string
  ): Promise<Sample> => {
    const response = await api.patch<SampleResponse>(
      `${BASE_URL}/${sampleId}/colorways/${colorwayId}/status`,
      { status }
    );
    return response.data.data;
  },

  // ============================================
  // SIZE SETS (Size Set Samples)
  // ============================================

  /**
   * Add or update size sets for a Size Set sample
   */
  updateSizeSets: async (
    sampleId: string,
    sizeSets: SampleSizeSetInput[]
  ): Promise<Sample> => {
    const response = await api.put<SampleResponse>(
      `${BASE_URL}/${sampleId}/size-sets`,
      { sizeSets }
    );
    return response.data.data;
  },

  /**
   * Update size set item status (approve/reject individual size/color)
   */
  updateSizeSetStatus: async (
    sampleId: string,
    sizeSetId: string,
    status: string
  ): Promise<Sample> => {
    const response = await api.patch<SampleResponse>(
      `${BASE_URL}/${sampleId}/size-sets/${sizeSetId}/status`,
      { status }
    );
    return response.data.data;
  },

  // ============================================
  // WORKFLOW ACTIONS
  // ============================================

  /**
   * Mark sample as sent (with shipping details)
   */
  markAsSent: async (
    id: string,
    data: {
      sentDate: string;
      courierMode?: string;
      trackingNumber?: string;
    }
  ): Promise<Sample> => {
    const response = await api.post<SampleResponse>(`${BASE_URL}/${id}/send`, data);
    return response.data.data;
  },

  /**
   * Record buyer receipt
   */
  recordReceipt: async (
    id: string,
    data: { receivedDate: string; remarks?: string }
  ): Promise<Sample> => {
    const response = await api.post<SampleResponse>(`${BASE_URL}/${id}/receive`, data);
    return response.data.data;
  },

  /**
   * Record buyer feedback
   */
  recordFeedback: async (
    id: string,
    data: {
      status: 'APPROVED' | 'REJECTED' | 'REVISION_NEEDED' | 'APPROVED_WITH_COMMENTS';
      feedback: string;
      feedbackDate?: string;
      measurementComments?: string;
    }
  ): Promise<Sample> => {
    const response = await api.post<SampleResponse>(`${BASE_URL}/${id}/feedback`, data);
    return response.data.data;
  },

  /**
   * Create a revision (new version of rejected FIT sample)
   */
  createRevision: async (id: string): Promise<Sample> => {
    const response = await api.post<SampleResponse>(`${BASE_URL}/${id}/revision`);
    return response.data.data;
  },

  // ============================================
  // QUERIES & LOOKUPS
  // ============================================

  /**
   * Get samples summary/stats
   */
  getSummary: async (styleId?: string): Promise<SampleSummary> => {
    let url = `${BASE_URL}/summary`;
    if (styleId) {
      url += `?styleId=${styleId}`;
    }
    const response = await api.get<{ data: SampleSummary }>(url);
    return response.data.data;
  },

  /**
   * Get samples by style (for style detail page)
   */
  getSamplesByStyle: async (styleId: string): Promise<Sample[]> => {
    const response = await api.get<SampleListResponse>(`${BASE_URL}?styleId=${styleId}&limit=100`);
    return response.data.data;
  },

  /**
   * Get approved FIT samples for a style (for PP sample creation)
   */
  getApprovedFitSamples: async (styleId: string): Promise<Sample[]> => {
    const response = await api.get<SampleListResponse>(
      `${BASE_URL}?styleId=${styleId}&sampleType=FIT_SAMPLE&status=APPROVED&limit=100`
    );
    return response.data.data;
  },

  /**
   * Get approved PP samples for a style (for Size Set sample creation)
   */
  getApprovedPPSamples: async (styleId: string): Promise<Sample[]> => {
    const response = await api.get<SampleListResponse>(
      `${BASE_URL}?styleId=${styleId}&sampleType=PP_SAMPLE&status=APPROVED&limit=100`
    );
    return response.data.data;
  },

  /**
   * Check if Size Set sample is approved for a style (gate for Work Order creation)
   */
  checkSampleApprovalGate: async (styleId: string): Promise<{
    fitApproved: boolean;
    ppApproved: boolean;
    sizeSetApproved: boolean;
    canCreateWorkOrder: boolean;
  }> => {
    const response = await api.get<{ data: {
      fitApproved: boolean;
      ppApproved: boolean;
      sizeSetApproved: boolean;
      canCreateWorkOrder: boolean;
    } }>(`${BASE_URL}/approval-gate/${styleId}`);
    return response.data.data;
  },

  /**
   * Search samples (for picker/dropdown)
   */
  searchSamples: async (
    search: string,
    sampleType?: string,
    limit: number = 20
  ): Promise<Sample[]> => {
    let url = `${BASE_URL}/search?search=${encodeURIComponent(search)}&limit=${limit}`;
    if (sampleType) {
      url += `&sampleType=${sampleType}`;
    }
    const response = await api.get<{ data: Sample[] }>(url);
    return response.data.data;
  },
};

export default sampleService;
