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
  currentSupplierId: string | null;
  suggestedSupplierId: string | null;
  suggestedSupplierName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: SupplierAlternative[];
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
  const response = await api.post<{ success: boolean; data: VendorSuggestion }>(
    '/mrp/vendor-suggestions/material',
    { materialId }
  );
  return response.data.data;
}

/**
 * Get vendor suggestions for multiple requirements
 * POST /api/mrp/vendor-suggestions/requirements
 */
export async function suggestForRequirements(
  requirementIds: string[]
): Promise<SuggestionsResponse> {
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
export async function bulkAssignVendors(
  assignments: BulkAssignmentInput[]
): Promise<BulkAssignResponse> {
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

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get confidence badge color
 */
export function getConfidenceBadgeColor(
  confidence: 'high' | 'medium' | 'low'
): string {
  switch (confidence) {
    case 'high':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-gray-100 text-gray-800 border-gray-200';
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
