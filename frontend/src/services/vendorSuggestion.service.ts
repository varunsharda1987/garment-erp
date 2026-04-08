/**
 * Vendor Suggestion Service
 * Frontend API service for intelligent supplier recommendations
 */

import api from '@/lib/api';

// ============================================
// TYPES
// ============================================

export interface VendorSuggestion {
  materialId: string;
  materialCode?: string;
  materialName?: string;
  suggestedSupplierId: string | null;
  suggestedSupplierName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: SupplierAlternative[];
}

export interface SupplierAlternative {
  supplierId: string;
  supplierName: string;
  lastOrderDate?: string;
  orderCount?: number;
  score?: number;
}

export interface VendorSuggestionForRequirement {
  requirementId: string;
  materialId: string;
  materialCode?: string;
  materialName?: string;
  materialType?: string;
  currentSupplierId: string | null;
  suggestedSupplierId: string | null;
  suggestedSupplierName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: SupplierAlternative[];
}

export interface SuppliersByTypeResponse {
  filteredSuppliers: Array<{
    // Changed from 'suppliers' to avoid serializer key transformation
    id: string;
    name: string;
    code?: string;
    supplierCategories: string[];
    isActive: boolean;
  }>;
  materialType: string | null;
  supplierCategories: string[];
  count: number;
}

export interface SuggestionsResponse {
  suggestions: VendorSuggestionForRequirement[];
  stats: {
    total: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    withSuggestion: number;
    needsManual: number;
  };
}

export interface BulkAssignmentInput {
  requirementId: string;
  supplierId: string;
}

export interface BulkAssignResponse {
  updatedCount: number;
  requested: number;
}

export interface AutoAssignResponse {
  assigned: number;
  skipped: number;
}

// ============================================
// API METHODS
// ============================================

/**
 * Get vendor suggestion for a single material
 * POST /api/mrp/vendor-suggestions/material
 */
export async function suggestForMaterial(materialId: string): Promise<VendorSuggestion> {
  const response = await api.post<{ success: boolean; data: VendorSuggestion }>('/mrp/vendor-suggestions/material', {
    materialId,
  });
  return response.data.data;
}

/**
 * Get vendor suggestions for multiple requirements
 * POST /api/mrp/vendor-suggestions/requirements
 */
export async function suggestForRequirements(requirementIds: string[]): Promise<SuggestionsResponse> {
  const response = await api.post<{ success: boolean; data: SuggestionsResponse }>(
    '/mrp/vendor-suggestions/requirements',
    { requirementIds }
  );
  return response.data.data;
}

/**
 * Bulk assign vendors to requirements
 * POST /api/mrp/vendor-suggestions/bulk-assign
 */
export async function bulkAssignVendors(assignments: BulkAssignmentInput[]): Promise<BulkAssignResponse> {
  const response = await api.post<{
    success: boolean;
    data: BulkAssignResponse;
    message: string;
  }>('/mrp/vendor-suggestions/bulk-assign', { assignments });
  return response.data.data;
}

/**
 * Auto-assign vendors based on suggestions
 * POST /api/mrp/vendor-suggestions/auto-assign
 */
export async function autoAssignVendors(
  requirementIds: string[],
  minConfidence: 'high' | 'medium' = 'medium'
): Promise<AutoAssignResponse> {
  const response = await api.post<{
    success: boolean;
    data: AutoAssignResponse;
    message: string;
  }>('/mrp/vendor-suggestions/auto-assign', { requirementIds, minConfidence });
  return response.data.data;
}

/**
 * Get suppliers filtered by material type
 * GET /api/mrp/vendor-suggestions/suppliers-by-type?materialType=GREIGE
 */
export async function getSuppliersByMaterialType(materialType: string | null): Promise<SuppliersByTypeResponse> {
  const params = materialType ? `?materialType=${encodeURIComponent(materialType)}` : '';
  const response = await api.get<{
    success: boolean;
    data: SuppliersByTypeResponse;
  }>(`/mrp/vendor-suggestions/suppliers-by-type${params}`);
  return response.data.data;
}

// ============================================
// PROCESSING REQUIREMENT PROCESSOR ASSIGNMENT
// ============================================

export interface ProcessingSuggestionForRequirement {
  requirementId: string;
  materialId: string;
  materialCode?: string;
  materialName?: string;
  currentProcessorId: string | null;
  currentProcessorName?: string;
  suggestedProcessorId: string | null;
  suggestedProcessorName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: Array<{ processorId: string; processorName: string; orderCount?: number }>;
}

export interface ProcessingSuggestionsResponse {
  suggestions: ProcessingSuggestionForRequirement[];
  stats: {
    total: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    withSuggestion: number;
    needsManual: number;
  };
}

export interface ProcessorAssignmentInput {
  requirementId: string;
  processorId: string;
}

export interface ProcessorListResponse {
  processorList: Array<{
    id: string;
    name: string;
    code?: string;
    supplierCategories: string[];
    isActive: boolean;
  }>;
  count: number;
}

/**
 * Get processor suggestions for PROCESSING material requirements
 */
export async function suggestProcessorsForProcessing(requirementIds: string[]): Promise<ProcessingSuggestionsResponse> {
  const response = await api.post<{ success: boolean; data: ProcessingSuggestionsResponse }>(
    '/mrp/processing-assignment/suggest',
    { requirementIds }
  );
  return response.data.data;
}

/**
 * Bulk assign processors to PROCESSING requirements
 */
export async function bulkAssignProcessorsForProcessing(
  assignments: ProcessorAssignmentInput[]
): Promise<BulkAssignResponse> {
  const response = await api.post<{ success: boolean; data: BulkAssignResponse; message: string }>(
    '/mrp/processing-assignment/bulk-assign',
    { assignments }
  );
  return response.data.data;
}

/**
 * Auto-assign processors to PROCESSING requirements
 */
export async function autoAssignProcessorsForProcessing(
  requirementIds: string[],
  minConfidence: 'high' | 'medium' = 'medium'
): Promise<AutoAssignResponse> {
  const response = await api.post<{ success: boolean; data: AutoAssignResponse; message: string }>(
    '/mrp/processing-assignment/auto-assign',
    { requirementIds, minConfidence }
  );
  return response.data.data;
}

/**
 * Get list of processor suppliers
 */
export async function getProcessorSuppliers(): Promise<ProcessorListResponse> {
  const response = await api.get<{ success: boolean; data: ProcessorListResponse }>(
    '/mrp/processing-assignment/processors'
  );
  return response.data.data;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

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
