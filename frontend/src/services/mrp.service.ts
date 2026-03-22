/**
 * MRP (Material Requirement Planning) Service
 * Frontend API service for material requirements management
 */

import api from '@/lib/api';
import type {
  MaterialRequirement,
  CalculateRequirementsRequest,
  CreateManualRequirementRequest,
  GeneratePORequest,
  AllocateStockRequest,
  LinkToPORequest,
  UpdateStatusRequest,
  RequirementFilters,
  RequirementListResponse,
  RequirementResponse,
  CalculationResultResponse,
  POGenerationResponse,
  DashboardStatsResponse,
  OrderSummaryResponse,
  MRPDashboardStats,
  OrderRequirementsSummary,
  POPreviewGroup,
} from '@/types/mrp.types';

const BASE_URL = '/mrp';

// ============================================
// CALCULATION & DASHBOARD
// ============================================

/**
 * Calculate material requirements from an order's BOM
 */
export async function calculateRequirements(
  data: CalculateRequirementsRequest
): Promise<CalculationResultResponse['data']> {
  const response = await api.post<CalculationResultResponse>(`${BASE_URL}/calculate`, data);
  return response.data.data;
}

/**
 * Get MRP dashboard statistics
 */
export async function getDashboardStats(): Promise<MRPDashboardStats> {
  const response = await api.get<DashboardStatsResponse>(`${BASE_URL}/dashboard`);
  return response.data.data;
}

// ============================================
// REQUIREMENTS CRUD
// ============================================

/**
 * Get all requirements with filters
 */
export async function getRequirements(filters?: RequirementFilters): Promise<RequirementListResponse> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.orderId) params.append('orderId', filters.orderId);
    if (filters.orderItemId) params.append('orderItemId', filters.orderItemId);
    if (filters.materialId) params.append('materialId', filters.materialId);
    if (filters.supplierId) params.append('supplierId', filters.supplierId);
    if (filters.styleId) params.append('styleId', filters.styleId);
    if (filters.source) params.append('source', filters.source);
    if (filters.requirementType) params.append('requirementType', filters.requirementType);
    if (filters.requiredDateFrom) params.append('requiredDateFrom', filters.requiredDateFrom);
    if (filters.requiredDateTo) params.append('requiredDateTo', filters.requiredDateTo);
    if (filters.hasShortfall !== undefined) params.append('hasShortfall', String(filters.hasShortfall));
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    // Handle status (can be single or array)
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        params.append('status', filters.status.join(','));
      } else {
        params.append('status', filters.status);
      }
    }
  }

  const response = await api.get<RequirementListResponse>(`${BASE_URL}/requirements?${params.toString()}`);
  return response.data;
}

/**
 * Get a single requirement by ID
 */
export async function getRequirementById(id: string): Promise<MaterialRequirement> {
  const response = await api.get<RequirementResponse>(`${BASE_URL}/requirements/${id}`);
  return response.data.data;
}

/**
 * Create a manual material requirement
 */
export async function createManualRequirement(data: CreateManualRequirementRequest): Promise<MaterialRequirement> {
  const response = await api.post<RequirementResponse>(`${BASE_URL}/requirements`, data);
  return response.data.data;
}

/**
 * Cancel a requirement
 */
export async function cancelRequirement(id: string): Promise<MaterialRequirement> {
  const response = await api.delete<RequirementResponse>(`${BASE_URL}/requirements/${id}`);
  return response.data.data;
}

// ============================================
// REQUIREMENT ACTIONS
// ============================================

/**
 * Allocate stock to a requirement
 */
export async function allocateStock(id: string, data: AllocateStockRequest): Promise<MaterialRequirement> {
  const response = await api.post<RequirementResponse>(`${BASE_URL}/requirements/${id}/allocate-stock`, data);
  return response.data.data;
}

/**
 * Link a requirement to an existing PO item
 */
export async function linkRequirementToPO(id: string, data: LinkToPORequest): Promise<MaterialRequirement> {
  const response = await api.post<RequirementResponse>(`${BASE_URL}/requirements/${id}/link-po`, data);
  return response.data.data;
}

/**
 * Update requirement status
 */
export async function updateRequirementStatus(id: string, data: UpdateStatusRequest): Promise<MaterialRequirement> {
  const response = await api.patch<RequirementResponse>(`${BASE_URL}/requirements/${id}/status`, data);
  return response.data.data;
}

// ============================================
// PO GENERATION
// ============================================

/**
 * Generate Purchase Order from requirements
 */
export async function generatePOFromRequirements(data: GeneratePORequest): Promise<POGenerationResponse['data']> {
  const response = await api.post<POGenerationResponse>(`${BASE_URL}/generate-po`, data);
  return response.data.data;
}

/**
 * Group requirements by supplier for bulk PO generation
 */
export async function groupRequirementsBySupplier(requirementIds: string[]): Promise<{
  groups: Record<string, MaterialRequirement[]>;
  unassigned: MaterialRequirement[];
  summary: {
    totalRequirements: number;
    totalSuppliers: number;
    unassignedCount: number;
  };
}> {
  const response = await api.post<{
    success: boolean;
    data: {
      groups: Record<string, MaterialRequirement[]>;
      unassigned: MaterialRequirement[];
      summary: {
        totalRequirements: number;
        totalSuppliers: number;
        unassignedCount: number;
      };
    };
  }>(`${BASE_URL}/group-by-supplier`, { requirementIds });
  return response.data.data;
}

/**
 * Preview POs with prices and GST breakdown before generation
 */
export async function previewPOs(
  groups: Array<{
    supplierId: string;
    requirementIds: string[];
    expectedDeliveryDate: string;
    remarks?: string;
  }>
): Promise<POPreviewGroup[]> {
  const response = await api.post<{
    success: boolean;
    data: POPreviewGroup[];
  }>(`${BASE_URL}/preview-pos`, { groups });
  return response.data.data;
}

/**
 * Generate multiple POs from grouped requirements (bulk operation)
 */
export async function bulkGeneratePOs(
  groups: Array<{
    supplierId: string;
    requirementIds: string[];
    expectedDeliveryDate: string;
    remarks?: string;
    itemPrices?: Record<string, number>;
  }>
): Promise<{
  purchaseOrders: Array<{ id: string; poNumber: string; supplierId: string; totalAmount: number }>;
  totalPOs: number;
  totalRequirements: number;
  errors: Array<{ supplierId: string; error: string }>;
}> {
  const response = await api.post<{
    success: boolean;
    data: {
      purchaseOrders: Array<{ id: string; poNumber: string; supplierId: string; totalAmount: number }>;
      totalPOs: number;
      totalRequirements: number;
      errors: Array<{ supplierId: string; error: string }>;
    };
    message: string;
  }>(`${BASE_URL}/generate-pos-bulk`, { groups });
  return response.data.data;
}

/**
 * Validate requirements for bulk PO generation
 */
export async function validateBulkPOGeneration(requirementIds: string[]): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  requirementsWithoutSupplier: string[];
}> {
  const response = await api.post<{
    success: boolean;
    data: {
      valid: boolean;
      errors: string[];
      warnings: string[];
      requirementsWithoutSupplier: string[];
    };
  }>(`${BASE_URL}/validate-bulk-po`, { requirementIds });
  return response.data.data;
}

// ============================================
// STYLE FILTER
// ============================================

/**
 * Get distinct styles that have material requirements (for filter dropdown)
 */
export async function getRequirementStyles(
  requirementType?: string
): Promise<{ id: string; styleCode: string; styleName: string }[]> {
  const params = requirementType ? `?requirementType=${requirementType}` : '';
  const response = await api.get<{ success: boolean; data: { id: string; styleCode: string; styleName: string }[] }>(
    `${BASE_URL}/requirements/styles${params}`
  );
  return response.data.data;
}

// ============================================
// ORDER-LEVEL ENDPOINTS
// ============================================

/**
 * Get requirements summary for an order
 */
export async function getOrderRequirementsSummary(orderId: string): Promise<OrderRequirementsSummary> {
  const response = await api.get<OrderSummaryResponse>(`${BASE_URL}/orders/${orderId}/summary`);
  return response.data.data;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get requirements that need PO generation
 */
export async function getRequirementsNeedingPO(
  filters?: Partial<RequirementFilters>
): Promise<RequirementListResponse> {
  return getRequirements({
    ...filters,
    status: ['PO_REQUIRED', 'PARTIAL_STOCK'],
    hasShortfall: true,
  });
}

/**
 * Get requirements for a specific order
 */
export async function getOrderRequirements(
  orderId: string,
  filters?: Partial<RequirementFilters>
): Promise<RequirementListResponse> {
  return getRequirements({
    ...filters,
    orderId,
  });
}

/**
 * Get overdue requirements
 */
export async function getOverdueRequirements(filters?: Partial<RequirementFilters>): Promise<RequirementListResponse> {
  const today = new Date().toISOString().split('T')[0];
  return getRequirements({
    ...filters,
    requiredDateTo: today,
    status: ['PENDING', 'PO_REQUIRED', 'PARTIAL_STOCK', 'PO_GENERATED', 'PO_SENT'],
  });
}

/**
 * Convert a MATERIAL requirement's shortfall to GREIGE + PROCESSING workflow
 */
export async function convertToGreigeProcessing(
  requirementId: string,
  data: { processorId: string; greigeId: string; processingCost?: number; greigeCost?: number }
): Promise<{ greigeRequirement: MaterialRequirement; processingRequirement: MaterialRequirement }> {
  const response = await api.post(`${BASE_URL}/requirements/${requirementId}/convert-to-greige`, data);
  return response.data.data;
}

export default {
  calculateRequirements,
  getDashboardStats,
  getRequirements,
  getRequirementById,
  createManualRequirement,
  cancelRequirement,
  allocateStock,
  linkRequirementToPO,
  updateRequirementStatus,
  generatePOFromRequirements,
  getOrderRequirementsSummary,
  getRequirementsNeedingPO,
  getOrderRequirements,
  getOverdueRequirements,
  convertToGreigeProcessing,
};
