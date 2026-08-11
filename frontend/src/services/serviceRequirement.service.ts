/**
 * Service Requirement Service
 * Frontend API service for work order service requirements management
 */

import api from '@/lib/api';
import type {
  ServiceRequirement,
  SuggestProcessorRequest,
  BulkProcessorAssignment,
  GenerateServiceJWORequest,
  BulkGenerateServiceJWOsRequest,
  UpdateServiceExecutionRequest,
  ServiceRequirementFilters,
  ServiceRequirementListResponse,
  ServiceRequirementResponse,
  CalculationResultResponse,
  ServiceJWOGenerationResponse,
  BulkServiceJWOGenerationResponse,
  DashboardStatsResponse,
  WorkOrderServiceSummaryResponse,
  OrderServiceSummaryResponse,
  ServiceDashboardStats,
  ServiceRequirementsSummary,
  OrderServiceRequirementsSummary,
  ProcessorSuggestion,
  ProcessorSuggestionsResponse,
  BulkAssignResponse,
  AutoAssignResponse,
  GroupByProcessorResponse,
} from '@/types/serviceRequirement.types';

// ============================================
// SERVICE CALCULATION & DASHBOARD
// ============================================

/**
 * Calculate service requirements from work order's style processes
 * POST /api/work-orders/:workOrderId/calculate-services
 */
export async function calculateServices(workOrderId: string): Promise<CalculationResultResponse['data']> {
  // The acting user is derived server-side from the auth token (req.user.userId) — the
  // browser has no reliable userId to send, so no body is required (bug B06-05).
  const response = await api.post<CalculationResultResponse>(`/work-orders/${workOrderId}/calculate-services`, {});
  return response.data.data;
}

/**
 * Get service requirements dashboard statistics
 * GET /api/service-requirements/dashboard
 */
export async function getDashboardStats(): Promise<ServiceDashboardStats> {
  const response = await api.get<DashboardStatsResponse>('/service-requirements/dashboard');
  return response.data.data;
}

// ============================================
// SERVICE REQUIREMENTS CRUD
// ============================================

/**
 * Get all service requirements with filters
 * GET /api/work-orders/:workOrderId/service-requirements
 */
export async function getServiceRequirements(
  workOrderId: string,
  filters?: ServiceRequirementFilters
): Promise<ServiceRequirementListResponse> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.serviceType) {
      if (Array.isArray(filters.serviceType)) {
        params.append('serviceType', filters.serviceType.join(','));
      } else {
        params.append('serviceType', filters.serviceType);
      }
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        params.append('status', filters.status.join(','));
      } else {
        params.append('status', filters.status);
      }
    }
    if (filters.processorId) params.append('processorId', filters.processorId);
    if (filters.source) params.append('source', filters.source);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  }

  const response = await api.get<ServiceRequirementListResponse>(
    `/work-orders/${workOrderId}/service-requirements?${params.toString()}`
  );
  return response.data;
}

/**
 * Get all service requirements (across all work orders)
 * GET /api/service-requirements/list
 */
export async function getAllServiceRequirements(
  filters?: ServiceRequirementFilters
): Promise<ServiceRequirementListResponse> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.orderId) params.append('orderId', filters.orderId);
    if (filters.workOrderId) params.append('workOrderId', filters.workOrderId);
    if (filters.serviceType) {
      if (Array.isArray(filters.serviceType)) {
        params.append('serviceType', filters.serviceType.join(','));
      } else {
        params.append('serviceType', filters.serviceType);
      }
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        params.append('status', filters.status.join(','));
      } else {
        params.append('status', filters.status);
      }
    }
    if (filters.processorId) params.append('processorId', filters.processorId);
    if (filters.source) params.append('source', filters.source);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  }

  const response = await api.get<ServiceRequirementListResponse>(`/service-requirements/list?${params.toString()}`);
  return response.data;
}

/**
 * Get service requirements summary for a work order
 * GET /api/work-orders/:workOrderId/service-requirements/summary
 */
export async function getServiceRequirementsSummary(workOrderId: string): Promise<ServiceRequirementsSummary> {
  const response = await api.get<WorkOrderServiceSummaryResponse>(
    `/work-orders/${workOrderId}/service-requirements/summary`
  );
  return response.data.data;
}

/**
 * Get service requirements summary for an order (across all work orders)
 * GET /api/orders/:orderId/service-requirements/summary
 */
export async function getOrderServiceRequirementsSummary(orderId: string): Promise<OrderServiceRequirementsSummary> {
  const response = await api.get<OrderServiceSummaryResponse>(`/orders/${orderId}/service-requirements/summary`);
  return response.data.data;
}

/**
 * Update service execution details
 * PATCH /api/service-requirements/:id/execution
 */
export async function updateServiceExecution(
  requirementId: string,
  data: UpdateServiceExecutionRequest
): Promise<ServiceRequirement> {
  const response = await api.patch<ServiceRequirementResponse>(
    `/service-requirements/${requirementId}/execution`,
    data
  );
  return response.data.data;
}

// ============================================
// PROCESSOR SUGGESTIONS
// ============================================

/**
 * Get processor suggestion for a service type
 * POST /api/service-requirements/suggest-processor
 */
export async function suggestProcessor(data: SuggestProcessorRequest): Promise<ProcessorSuggestion> {
  const response = await api.post<{ success: boolean; data: ProcessorSuggestion }>(
    '/service-requirements/suggest-processor',
    data
  );
  return response.data.data;
}

/**
 * Get processor suggestions for multiple requirements
 * POST /api/service-requirements/suggest-processors-bulk
 */
export async function suggestProcessorsForRequirements(
  requirementIds: string[]
): Promise<ProcessorSuggestionsResponse['data']> {
  const response = await api.post<ProcessorSuggestionsResponse>('/service-requirements/suggest-processors-bulk', {
    requirementIds,
  });
  return response.data.data;
}

// ============================================
// PROCESSOR ASSIGNMENT
// ============================================

/**
 * Bulk assign processors to service requirements
 * POST /api/service-requirements/bulk-assign-processors
 */
export async function bulkAssignProcessors(assignments: BulkProcessorAssignment[]): Promise<BulkAssignResponse> {
  const response = await api.post<{
    success: boolean;
    data: BulkAssignResponse;
    message: string;
  }>('/service-requirements/bulk-assign-processors', { assignments });
  return response.data.data;
}

/**
 * Auto-assign processors based on suggestions
 * POST /api/service-requirements/auto-assign-processors
 */
export async function autoAssignProcessors(
  requirementIds: string[],
  minConfidence: 'high' | 'medium' = 'medium'
): Promise<AutoAssignResponse> {
  const response = await api.post<{
    success: boolean;
    data: AutoAssignResponse;
    message: string;
  }>('/service-requirements/auto-assign-processors', {
    requirementIds,
    minConfidence,
  });
  return response.data.data;
}

// ============================================
// GROUPING AND BULK PO GENERATION
// ============================================

/**
 * Group service requirements by processor for bulk PO generation
 * POST /api/service-requirements/group-by-processor
 */
export async function groupRequirementsByProcessor(
  requirementIds: string[]
): Promise<GroupByProcessorResponse['data']> {
  const response = await api.post<GroupByProcessorResponse>('/service-requirements/group-by-processor', {
    requirementIds,
  });
  return response.data.data;
}

/**
 * Generate Job Work Order(s) for service requirements — Phase 5a (replaces generate-po)
 * POST /api/service-requirements/generate-jwo
 */
export async function generateServiceJWOs(
  data: GenerateServiceJWORequest
): Promise<ServiceJWOGenerationResponse['data']> {
  const response = await api.post<ServiceJWOGenerationResponse>('/service-requirements/generate-jwo', data);
  return response.data.data;
}

/**
 * Bulk generate Job Work Orders per processor group — Phase 5a (replaces generate-pos-bulk)
 * POST /api/service-requirements/generate-jwos-bulk
 */
export async function bulkGenerateServiceJWOs(
  groups: BulkGenerateServiceJWOsRequest['groups']
): Promise<BulkServiceJWOGenerationResponse['data']> {
  const response = await api.post<BulkServiceJWOGenerationResponse>('/service-requirements/generate-jwos-bulk', {
    groups,
  });
  return response.data.data;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get service requirements that need PO generation
 */
export async function getRequirementsNeedingPO(
  filters?: Partial<ServiceRequirementFilters>
): Promise<ServiceRequirementListResponse> {
  return getAllServiceRequirements({
    ...filters,
    status: ['PENDING'],
  });
}

/**
 * Get overdue service requirements
 */
export async function getOverdueRequirements(
  filters?: Partial<ServiceRequirementFilters>
): Promise<ServiceRequirementListResponse> {
  return getAllServiceRequirements({
    ...filters,
    status: ['PENDING', 'PO_GENERATED', 'IN_PROGRESS'],
  });
}

/**
 * Get service requirements for a specific work order
 */
export async function getWorkOrderRequirements(
  workOrderId: string,
  filters?: Partial<ServiceRequirementFilters>
): Promise<ServiceRequirementListResponse> {
  return getServiceRequirements(workOrderId, filters);
}

/**
 * Get confidence badge color
 */
export function getConfidenceBadgeColor(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return 'bg-success-muted text-success border-success/20';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-muted text-foreground border-border';
  }
}

/**
 * Get confidence icon
 */
export function getConfidenceIcon(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return '✓';
    case 'medium':
      return '~';
    case 'low':
      return '?';
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  calculateServices,
  getDashboardStats,
  getServiceRequirements,
  getAllServiceRequirements,
  getServiceRequirementsSummary,
  getOrderServiceRequirementsSummary,
  updateServiceExecution,
  suggestProcessor,
  suggestProcessorsForRequirements,
  bulkAssignProcessors,
  autoAssignProcessors,
  groupRequirementsByProcessor,
  generateServiceJWOs,
  bulkGenerateServiceJWOs,
  getRequirementsNeedingPO,
  getOverdueRequirements,
  getWorkOrderRequirements,
  getConfidenceBadgeColor,
  getConfidenceIcon,
};
