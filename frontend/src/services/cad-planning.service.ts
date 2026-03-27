/**
 * CAD Planning Service
 *
 * Dedicated service for CAD Planning module.
 * Uses the new /api/cad-planning/ endpoints.
 */

import api from '../lib/api';
import type {
  CADTableData,
  CADSpreadsheetRow,
  CADOrderHistoryResponse,
  CreateProductionCADFromStockRequest,
} from '../types/cad-planning.types';

// ============================================
// Types
// ============================================

export interface CADStatusCounts {
  PENDING: number;
  IN_PROGRESS: number;
  APPROVED: number;
}

export interface CADWidthDetail {
  id: string;
  cutableWidth: number;
  layerLength: number; // Renamed from cadMeters for clarity (stores layer/marker length)
  cadAverage: number | null; // Per-piece consumption: (layerLength + margin) / piecesPerMarker
  purpose: 'PRODUCTION' | 'COSTING' | 'RAW_MATERIAL_CALCULATION' | null;
  greigeName: string | null;
  greigeCode: string | null;
}

export interface CADPlanningStyle {
  id: string;
  styleCode: string;
  styleName: string;
  cadStatus: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  approvedCadDate: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  buyerName: string | null;
  brandName: string | null;
  categoryName: string | null;
  componentCount: number;
  fabricSummary: string;
  cadDetails?: CADWidthDetail[]; // CAD width details with greige info (optional)
}

export interface CADPlanningListResponse {
  success: boolean;
  data: {
    style: CADPlanningStyle[]; // Serializer maps 'styles' → 'style' (RELATION_MAPPINGS)
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface AddCADRowRequest {
  purpose?: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION';
  componentId: string;
  styleFabricId: string;
  partId?: string;
  isEmbroidery?: boolean;
  /** Required for PRODUCTION purpose - links CAD row to actual stock */
  fabricStockId?: string;
}

export interface UpdateCADRowRequest {
  purpose?: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION';
  partId?: string;
  isEmbroidery?: boolean;
  greigeId?: string;
  cutableWidth?: number;
  printDirection?: string;
  sizeBreakdowns?: Array<{ sizeName: string; quantity: number }>;
  cadMeters?: number;
  piecesPerMarker?: number;
  markerEfficiency?: number;
  cadWastagePercent?: number;
  layerMarginMeters?: number;
  notes?: string;
}

export interface ApproveCADRequest {
  purpose: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION';
  approvalNotes?: string;
}

export interface RejectCADRequest {
  purpose: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION';
  rejectionNotes: string;
}

export interface CopyCADRequest {
  sourceCadId: string;
  targetPurpose: 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION';
  styleFabricId: string;
  componentId?: string;
  patternPartId?: string;
}

export interface LinkStockRequest {
  cadRowId: string;
  fabricStockId: string;
}

// ============================================
// Error Handling Utility
// ============================================

/**
 * Handles CAD API errors with user-friendly messages
 * @param error - The error from the API call
 * @throws Error with user-friendly message
 */
function handleCADError(error: unknown): never {
  const err = error as { response?: { status?: number; data?: { message?: string } } };
  if (err.response?.status === 403) {
    const message =
      err.response.data?.message || 'This CAD entry is locked and cannot be modified. Please contact an administrator.';
    throw new Error(message);
  }
  throw error;
}

// ============================================
// Service
// ============================================

export const cadPlanningService = {
  // ============================================
  // LIST OPERATIONS
  // ============================================

  /**
   * Get styles for CAD planning list
   * @param params.status - Filter by status (PENDING includes IN_PROGRESS)
   * @param params.searchAll - When true, search across all statuses (unified search)
   */
  async getStylesForCADPlanning(params: {
    status?: 'PENDING' | 'APPROVED';
    page?: number;
    limit?: number;
    search?: string;
    searchAll?: boolean; // Search across all statuses
  }): Promise<CADPlanningListResponse> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));
    if (params.search) queryParams.append('search', params.search);
    if (params.searchAll) queryParams.append('searchAll', 'true');

    const response = await api.get<CADPlanningListResponse>(`/cad-planning/styles?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get CAD status counts for tabs
   */
  async getCADStatusCounts(): Promise<CADStatusCounts> {
    const response = await api.get<{ success: boolean; data: CADStatusCounts }>('/cad-planning/status-counts');
    return response.data.data;
  },

  // ============================================
  // STYLE-SPECIFIC OPERATIONS
  // ============================================

  /**
   * Get CAD spreadsheet table data for a style
   */
  async getCADTableData(styleId: string): Promise<{ success: boolean; data: CADTableData }> {
    const response = await api.get(`/cad-planning/${styleId}/table`);
    return response.data;
  },

  /**
   * Get enhanced CAD planning data
   */
  async getEnhancedCADPlanning(styleId: string) {
    const response = await api.get(`/cad-planning/${styleId}`);
    return response.data;
  },

  /**
   * Get CAD summary for a style
   */
  async getStyleCADSummary(styleId: string) {
    const response = await api.get(`/cad-planning/${styleId}/summary`);
    return response.data;
  },

  /**
   * Get CAD history for a style
   */
  async getStyleCADHistory(styleId: string) {
    const response = await api.get(`/cad-planning/${styleId}/history`);
    return response.data;
  },

  /**
   * Get CAD order usage history for a style
   */
  async getCADOrderHistory(styleId: string): Promise<CADOrderHistoryResponse> {
    const response = await api.get<{ success: boolean; data: CADOrderHistoryResponse }>(
      `/cad-planning/${styleId}/order-history`
    );
    return response.data.data;
  },

  // ============================================
  // CAD ROW OPERATIONS
  // ============================================

  /**
   * Add a new CAD row
   */
  async addCADTableRow(
    styleId: string,
    data: AddCADRowRequest
  ): Promise<{ success: boolean; data: CADSpreadsheetRow }> {
    const response = await api.post(`/cad-planning/${styleId}/row`, data);
    return response.data;
  },

  /**
   * Add a combined CAD row from multiple style fabrics
   */
  async addCombinedCADRow(
    styleId: string,
    styleFabricIds: string[],
    purpose?: string
  ): Promise<{ success: boolean; data: CADSpreadsheetRow }> {
    const response = await api.post(`/cad-planning/${styleId}/combined-row`, {
      styleFabricIds,
      purpose,
    });
    return response.data;
  },

  /**
   * Update a CAD row
   */
  async updateCADTableRow(
    styleId: string,
    rowId: string,
    data: UpdateCADRowRequest
  ): Promise<{ success: boolean; data: CADSpreadsheetRow }> {
    try {
      const response = await api.put(`/cad-planning/${styleId}/row/${rowId}`, data);
      return response.data;
    } catch (error) {
      handleCADError(error);
    }
  },

  /**
   * Delete a CAD row
   */
  async deleteCADTableRow(styleId: string, rowId: string): Promise<{ success: boolean }> {
    try {
      const response = await api.delete(`/cad-planning/${styleId}/row/${rowId}`);
      return response.data;
    } catch (error) {
      handleCADError(error);
    }
  },

  // ============================================
  // APPROVAL OPERATIONS
  // ============================================

  /**
   * Approve a CAD purpose
   */
  async approveCADPurpose(
    styleId: string,
    rowId: string,
    data: ApproveCADRequest
  ): Promise<{ success: boolean; data: CADSpreadsheetRow }> {
    const response = await api.post(`/cad-planning/${styleId}/row/${rowId}/approve`, data);
    return response.data;
  },

  /**
   * Reject a CAD purpose
   */
  async rejectCADPurpose(
    styleId: string,
    rowId: string,
    data: RejectCADRequest
  ): Promise<{ success: boolean; data: CADSpreadsheetRow }> {
    const response = await api.post(`/cad-planning/${styleId}/row/${rowId}/reject`, data);
    return response.data;
  },

  /**
   * Create new version of PLANNING CAD
   */
  async createPlanningVersion(
    styleId: string,
    rowId: string,
    data: { versionReason?: string }
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      newCadId: string;
      version: number;
      baseCadId: string;
      baseVersion: number;
    };
  }> {
    const response = await api.post(`/cad-planning/${styleId}/planning/${rowId}/create-version`, data);
    return response.data;
  },

  /**
   * Copy CAD between purposes
   */
  async copyCADPurpose(styleId: string, data: CopyCADRequest): Promise<{ success: boolean; data: CADSpreadsheetRow }> {
    const response = await api.post(`/cad-planning/${styleId}/copy`, data);
    return response.data;
  },

  /**
   * Clone RAW_MAT CAD from a previous order's CAD
   * Creates a new RAW_MAT CAD based on the settings from a previous order
   */
  async cloneRawMatFromOrder(
    styleId: string,
    data: {
      sourceOrderId: string;
      sourceCadId: string;
      adjustQuantities?: boolean;
    }
  ): Promise<{ success: boolean; data: CADSpreadsheetRow; message: string }> {
    const response = await api.post(`/cad-planning/${styleId}/clone-from-order`, data);
    return response.data;
  },

  /**
   * Link PRODUCTION CAD to fabric stock
   */
  async linkCADToStock(
    styleId: string,
    data: LinkStockRequest
  ): Promise<{ success: boolean; data: CADSpreadsheetRow }> {
    const response = await api.post(`/cad-planning/${styleId}/link-stock`, data);
    return response.data;
  },

  /**
   * Approve CAD plan and link fabrics to selected CAD entries
   */
  async approveCADPlan(
    styleId: string,
    data: { fabricCADMappings: Array<{ fabricId: string; fabricCADId: string }> }
  ): Promise<{ success: boolean; message: string; updated: number }> {
    const response = await api.put(`/cad-planning/${styleId}/approve-cad`, data);
    return response.data;
  },

  // ============================================
  // PRODUCTION CAD FROM STOCK
  // ============================================

  /**
   * Create PRODUCTION CAD from fabric stock receipt
   */
  async createProductionCADFromStock(
    styleId: string,
    data: CreateProductionCADFromStockRequest
  ): Promise<{ success: boolean; data: CADSpreadsheetRow }> {
    const response = await api.post(`/cad-planning/${styleId}/production-from-stock`, data);
    return response.data;
  },

  // ============================================
  // GREIGE OPERATIONS
  // ============================================

  /**
   * Get available greige options for a generic fabric name
   */
  async getGreigeOptions(genericGreigeName: string) {
    const response = await api.get(
      `/cad-planning/greige-options?genericGreigeName=${encodeURIComponent(genericGreigeName)}`
    );
    return response.data;
  },

  /**
   * Get available widths for a greige
   */
  async getGreigeWidths(greigeId: string) {
    const response = await api.get(`/cad-planning/greige/${greigeId}/widths`);
    return response.data;
  },

  // ============================================
  // PATTERN PARTS
  // ============================================

  /**
   * Get pattern parts assigned to a style fabric
   */
  async getStyleFabricPatternParts(styleId: string, fabricId: string) {
    const response = await api.get(`/cad-planning/${styleId}/fabrics/${fabricId}/pattern-parts`);
    return response.data;
  },

  /**
   * Assign pattern parts to a style fabric
   */
  async assignPatternParts(
    styleId: string,
    fabricId: string,
    patternParts: Array<{
      patternPartId: string;
      quantity?: number;
      goesToEmbroidery?: boolean;
      notes?: string;
    }>
  ) {
    const response = await api.post(`/cad-planning/${styleId}/fabrics/${fabricId}/pattern-parts`, {
      patternParts,
    });
    return response.data;
  },

  /**
   * Get pattern parts for a component
   */
  async getCADPatternPartsForComponent(styleId: string, componentId: string) {
    const response = await api.get(`/cad-planning/${styleId}/components/${componentId}/pattern-parts`);
    return response.data;
  },

  // ============================================
  // EMBROIDERY CAD
  // ============================================

  /**
   * Get embroidery CAD for a style fabric
   */
  async getEmbroideryCad(styleId: string, fabricId: string) {
    const response = await api.get(`/cad-planning/${styleId}/fabrics/${fabricId}/embroidery-cad`);
    return response.data;
  },

  /**
   * Create or update embroidery CAD
   */
  async createOrUpdateEmbroideryCad(
    styleId: string,
    fabricId: string,
    data: {
      fabricWidthCadId?: string;
      embroideryId?: string;
      cadMeters?: number;
      cadYards?: number;
      cadWastagePercent?: number;
      layerMarginMeters?: number;
      piecesPerMarker?: number;
      markerEfficiency?: number;
      printDirection?: string;
      notes?: string;
      sizeBreakdowns?: Array<{ sizeName: string; sizeId?: string; quantity: number }>;
    }
  ) {
    const response = await api.post(`/cad-planning/${styleId}/fabrics/${fabricId}/embroidery-cad`, data);
    return response.data;
  },

  /**
   * Delete embroidery CAD
   */
  async deleteEmbroideryCad(styleId: string, fabricId: string) {
    const response = await api.delete(`/cad-planning/${styleId}/fabrics/${fabricId}/embroidery-cad`);
    return response.data;
  },

  /**
   * Get total CAD for a style fabric (Main CAD + Embroidery CAD)
   */
  async getTotalFabricCad(styleId: string, fabricId: string) {
    const response = await api.get(`/cad-planning/${styleId}/fabrics/${fabricId}/total-cad`);
    return response.data;
  },

  // ============================================
  // COPY AS DRAFT WORKFLOW - NEW
  // ============================================

  /**
   * Copy CAD record to next purpose (Copy as Draft workflow)
   * Creates PENDING record in target purpose for manual review
   */
  async copyCADRecord(styleId: string, request: CopyCADRequest) {
    const response = await api.post(`/cad-planning/${styleId}/copy`, request);
    return response.data;
  },

  /**
   * Get copy lineage for a CAD record
   * Returns source → current → children hierarchy
   */
  async getCADLineage(styleId: string, rowId: string) {
    const response = await api.get(`/cad-planning/${styleId}/row/${rowId}/lineage`);
    return response.data;
  },
};

export default cadPlanningService;
