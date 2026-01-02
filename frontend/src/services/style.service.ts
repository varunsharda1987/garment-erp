// Style Master service
import api from '../lib/api';
import type {
  Style,
  StylesListResponse,
  StyleResponse,
  DashboardSummary,
  DashboardSummaryResponse,
  CreateStyleFormData,
  CostingFormData,
  ComponentFormData,
  FabricFormData,
  AccessoryFormData,
  ProcessFormData,
  DraftsListResponse,
  DraftResponse,
  StyleVariantsResponse,
  CADPlanningResponse,
  CADGroupingResponse,
  CADApprovalResponse,
  CADTableDataResponse,
  AddCADRowRequest,
  UpdateCADRowRequest,
  GreigeWidthsResponse,
  CADSpreadsheetRow,
} from '../types/style.types';

export const styleService = {
  // ============================================
  // STYLE CRUD OPERATIONS
  // ============================================

  /**
   * Get all styles with pagination and search
   */
  getAllStyles: async (
    page: number = 1,
    limit: number = 10,
    search?: string,
    stage?: string,
    cadStatus?: string,
    customerName?: string
  ): Promise<StylesListResponse> => {
    let url = `/styles?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (stage) {
      url += `&stage=${stage}`;
    }
    if (cadStatus) {
      url += `&cadStatus=${cadStatus}`;
    }
    if (customerName) {
      url += `&customerName=${encodeURIComponent(customerName)}`;
    }
    const response = await api.get<StylesListResponse>(url);
    return response.data;
  },

  /**
   * Get style by ID with all related data
   */
  getStyleById: async (id: string): Promise<Style> => {
    const response = await api.get<StyleResponse>(`/styles/${id}`);
    return response.data.data;
  },

  /**
   * Create new style
   */
  createStyle: async (data: CreateStyleFormData): Promise<StyleResponse> => {
    const response = await api.post<StyleResponse>('/styles', data);
    return response.data;
  },

  /**
   * Update style
   */
  updateStyle: async (id: string, data: Partial<CreateStyleFormData>): Promise<Style> => {
    const response = await api.put<StyleResponse>(`/styles/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete (deactivate) style - soft delete
   */
  deleteStyle: async (id: string): Promise<void> => {
    await api.delete(`/styles/${id}`);
  },

  /**
   * Check if style can be deactivated
   */
  canDeactivate: async (id: string): Promise<DeactivationCheck> => {
    const response = await api.get<DeactivationCheck>(`/styles/${id}/can-deactivate`);
    return response.data;
  },

  /**
   * Permanently delete a style - hard delete (cannot be recovered)
   */
  permanentDeleteStyle: async (id: string): Promise<void> => {
    await api.delete(`/styles/${id}/permanent`);
  },

  /**
   * Restore a soft-deleted style
   */
  restoreStyle: async (id: string): Promise<StyleResponse> => {
    const response = await api.post<StyleResponse>(`/styles/${id}/restore`);
    return response.data;
  },

  /**
   * Get all deleted/archived styles with pagination
   */
  getDeletedStyles: async (
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<StylesListResponse> => {
    let url = `/styles/deleted?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const response = await api.get<StylesListResponse>(url);
    return response.data;
  },

  /**
   * Upload style image
   */
  uploadStyleImage: async (id: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    // Don't set Content-Type header - browser will set it with boundary automatically
    const response = await api.post<StyleResponse>(`/styles/${id}/image`, formData);
    return response.data.data.imageUrl || '';
  },

  /**
   * Create or update style variants
   */
  createStyleVariants: async (
    styleId: string,
    variants: Array<{ size: string; sku: string; barcode?: string; isActive: boolean }>
  ): Promise<StyleVariantsResponse> => {
    const response = await api.post<StyleVariantsResponse>(`/styles/${styleId}/variants`, { variants });
    return response.data;
  },

  // ============================================
  // DRAFT OPERATIONS
  // ============================================

  /**
   * Get all draft styles
   */
  getAllDrafts: async (params?: { page?: number; limit?: number }): Promise<DraftsListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await api.get<DraftsListResponse>(`/styles/drafts?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get a single draft by ID
   */
  getDraftById: async (id: string): Promise<DraftResponse> => {
    const response = await api.get<DraftResponse>(`/styles/drafts/${id}`);
    return response.data;
  },

  /**
   * Save draft (same as createStyle, but status will be DRAFT by default)
   */
  saveDraft: async (data: Partial<CreateStyleFormData> & { id?: string }): Promise<StyleResponse> => {
    // If data has an ID, update it; otherwise create new draft
    if (data.id) {
      const response = await api.put<StyleResponse>(`/styles/${data.id}`, { ...data, status: 'DRAFT' });
      return response.data;
    } else {
      const response = await api.post<StyleResponse>('/styles', { ...data, status: 'DRAFT' });
      return response.data;
    }
  },

  /**
   * Delete a draft
   */
  deleteDraft: async (id: string): Promise<void> => {
    await api.delete(`/styles/drafts/${id}`);
  },

  /**
   * Publish a draft (convert to ACTIVE status)
   */
  publishDraft: async (id: string): Promise<StyleResponse> => {
    const response = await api.post<StyleResponse>(`/styles/${id}/publish`);
    return response.data;
  },

  /**
   * Update production stage for a style
   */
  updateProductionStage: async (id: string, newStage: string, pieces?: number, notes?: string): Promise<void> => {
    await api.put(`/styles/${id}/production-stage`, { newStage, pieces, notes });
  },

  // ============================================
  // COMPONENT OPERATIONS
  // ============================================

  /**
   * Add component to style
   */
  createComponent: async (styleId: string, data: ComponentFormData) => {
    const response = await api.post(`/styles/${styleId}/components`, data);
    return response.data.data;
  },

  /**
   * Update component
   */
  updateComponent: async (componentId: string, data: Partial<ComponentFormData>) => {
    const response = await api.put(`/components/${componentId}`, data);
    return response.data.data;
  },

  /**
   * Delete component
   */
  deleteComponent: async (componentId: string): Promise<void> => {
    await api.delete(`/components/${componentId}`);
  },

  // ============================================
  // FABRIC OPERATIONS
  // ============================================

  /**
   * Add fabric to component
   */
  createFabric: async (componentId: string, data: FabricFormData) => {
    const response = await api.post(`/components/${componentId}/fabrics`, data);
    return response.data.data;
  },

  /**
   * Update fabric
   */
  updateFabric: async (fabricId: string, data: Partial<FabricFormData>) => {
    const response = await api.put(`/fabrics/${fabricId}`, data);
    return response.data.data;
  },

  /**
   * Delete fabric
   */
  deleteFabric: async (fabricId: string): Promise<void> => {
    await api.delete(`/fabrics/${fabricId}`);
  },

  // ============================================
  // ACCESSORY OPERATIONS
  // ============================================

  /**
   * Add accessory to component
   */
  createAccessory: async (componentId: string, data: AccessoryFormData) => {
    const response = await api.post(`/components/${componentId}/accessories`, data);
    return response.data.data;
  },

  /**
   * Update accessory
   */
  updateAccessory: async (accessoryId: string, data: Partial<AccessoryFormData>) => {
    const response = await api.put(`/accessories/${accessoryId}`, data);
    return response.data.data;
  },

  /**
   * Delete accessory
   */
  deleteAccessory: async (accessoryId: string): Promise<void> => {
    await api.delete(`/accessories/${accessoryId}`);
  },

  // ============================================
  // PROCESS OPERATIONS
  // ============================================

  /**
   * Add process to style
   */
  createProcess: async (styleId: string, data: ProcessFormData) => {
    const response = await api.post(`/styles/${styleId}/processes`, data);
    return response.data.data;
  },

  /**
   * Update process
   */
  updateProcess: async (processId: string, data: Partial<ProcessFormData>) => {
    const response = await api.put(`/processes/${processId}`, data);
    return response.data.data;
  },

  /**
   * Delete process
   */
  deleteProcess: async (processId: string): Promise<void> => {
    await api.delete(`/processes/${processId}`);
  },

  // ============================================
  // COSTING OPERATIONS
  // ============================================

  /**
   * Create or update costing
   */
  createOrUpdateCosting: async (styleId: string, data: CostingFormData) => {
    const response = await api.post(`/styles/${styleId}/costing`, data);
    return response.data.data;
  },

  /**
   * Get costing for a style
   */
  getCosting: async (styleId: string) => {
    const response = await api.get(`/styles/${styleId}/costing`);
    return response.data.data;
  },

  /**
   * Auto-calculate costing from components
   */
  calculateCosting: async (styleId: string) => {
    const response = await api.post(`/styles/${styleId}/costing/calculate`);
    return response.data.data;
  },

  // ============================================
  // DASHBOARD OPERATIONS
  // ============================================

  /**
   * Get dashboard summary
   */
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get<DashboardSummaryResponse>('/dashboard/summary');
    return response.data.data;
  },

  /**
   * Get styles in a specific production stage
   */
  getStylesByStage: async (stage: string): Promise<Style[]> => {
    const response = await api.get<{ data: Style[] }>(`/dashboard/stage/${stage}`);
    return response.data.data;
  },

  // ============================================
  // CAD PLANNING OPERATIONS
  // ============================================

  /**
   * Get enhanced CAD planning data for a style
   * Returns fabric groups with greige options and CAD entries
   */
  getStyleCADPlanning: async (id: string): Promise<CADPlanningResponse> => {
    const response = await api.get<{ data: CADPlanningResponse }>(`/styles/${id}/cad-planning`);
    return response.data.data;
  },

  /**
   * Select greige for a fabric group and set averaging mode
   * This creates CAD width options based on greige width
   */
  selectGreigeForGroup: async (styleId: string, data: {
    groupKey: string;
    greigeId: string;
    averagingMode: 'COMBINED' | 'SEPARATE';
  }): Promise<{
    message: string;
    cadOptions: Array<{
      id: string;
      cutableWidth: number;
      cadMeters: number | null;
      layerMarginMeters: number;
      wastagePercent: number;
      processingPricePerMeter: number | null;
      isSelected: boolean;
    }>;
  }> => {
    const response = await api.post(`/styles/${styleId}/cad-planning/select-greige`, data);
    return response.data;
  },

  /**
   * Update CAD values for a specific width entry
   * Layer margin is auto-calculated based on CAD meters but can be overridden
   */
  updateCADValues: async (cadId: string, data: {
    cutableWidth?: number;
    cadMeters?: number;
    cadYards?: number;
    cadWastagePercent?: number;
    layerMarginMeters?: number;
    piecesPerMarker?: number;
    markerLengthMeters?: number;
    processingPricePerMeter?: number;
    markerEfficiency?: number;
    printDirection?: string;
    notes?: string;
    sizeBreakdowns?: Array<{ sizeName: string; sizeId?: string | null; quantity: number }>;
  }): Promise<{
    data: {
      id: string;
      cutableWidth: number;
      cadMeters: number | null;
      layerMarginMeters: number;
      cadWastagePercent: number;
      piecesPerMarker: number | null;
      markerLengthMeters: number | null;
      processingPricePerMeter: number | null;
    };
    message: string;
  }> => {
    const response = await api.put(`/styles/cad-planning/update-cad/${cadId}`, data);
    return response.data;
  },

  /**
   * Approve CAD plan and link fabrics to selected CAD entries
   * Maps each fabric to its selected CAD entry
   */
  approveCADPlan: async (id: string, data: {
    fabricCADMappings: Array<{
      fabricId: string;
      fabricCADId: string;
    }>
  }): Promise<CADApprovalResponse> => {
    const response = await api.put<CADApprovalResponse>(`/styles/${id}/approve-cad`, data);
    return response.data;
  },

  /**
   * Add a new CAD width option for a fabric group
   * POST /api/styles/:styleId/cad-planning/add-width
   */
  addCADWidth: async (styleId: string, data: {
    groupKey: string;
    cutableWidth: number;
    componentName?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      id: string;
      cutableWidth: number;
      cadMeters: number | null;
      layerMarginMeters: number | null;
      cadWastagePercent: number;
      piecesPerMarker: number | null;
      markerLengthMeters: number | null;
      processingPricePerMeter: number | null;
      printDirection: string | null;
      componentName: string | null;
      isPreferred: boolean;
    };
  }> => {
    const response = await api.post(`/styles/${styleId}/cad-planning/add-width`, data);
    return response.data;
  },

  /**
   * Delete a CAD width entry
   * DELETE /api/styles/cad-planning/cad/:cadId
   */
  deleteCADWidth: async (cadId: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await api.delete(`/styles/cad-planning/cad/${cadId}`);
    return response.data;
  },

  /**
   * Set a CAD width as preferred for its fabric
   * PUT /api/styles/cad-planning/cad/:cadId/set-preferred
   */
  setPreferredCAD: async (cadId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      id: string;
      isPreferred: boolean;
    };
  }> => {
    const response = await api.put(`/styles/cad-planning/cad/${cadId}/set-preferred`);
    return response.data;
  },

  /**
   * Update CAD grouping for style fabrics (legacy - for backward compatibility)
   */
  updateCADGrouping: async (id: string, data: { fabricGroups: Array<{ fabricId: string; cadGroupKey: string }> }): Promise<CADGroupingResponse> => {
    const response = await api.post<CADGroupingResponse>(`/styles/${id}/cad-groups`, data);
    return response.data;
  },

  /**
   * Generate CAD options for a fabric group (legacy - for backward compatibility)
   */
  generateCADOptions: async (data: {
    styleId: string;
    genericFabricName: string;
    greigeId?: string;
    widths?: number[];
  }): Promise<{ data: { options: Array<{ id: string; cutableWidth: number; cadMeters: number | null; cadYards: number | null; cadWastagePercent: number; markerEfficiency: number | null; isPreferred: boolean }> } }> => {
    const response = await api.post('/styles/cad-planning/generate', data);
    return response.data;
  },

  // ============================================
  // CAD SPREADSHEET TABLE OPERATIONS
  // ============================================

  /**
   * Get CAD spreadsheet table data for a style
   */
  getCADTableData: async (styleId: string): Promise<CADTableDataResponse> => {
    const response = await api.get(`/styles/${styleId}/cad-table`);
    return response.data;
  },

  /**
   * Add a new CAD row to the spreadsheet table
   */
  addCADTableRow: async (
    styleId: string,
    data: AddCADRowRequest
  ): Promise<{ success: boolean; data: CADSpreadsheetRow; message?: string }> => {
    const response = await api.post(`/styles/${styleId}/cad-table/row`, data);
    return response.data;
  },

  /**
   * Update a CAD row in the spreadsheet table
   */
  updateCADTableRow: async (
    styleId: string,
    rowId: string,
    data: UpdateCADRowRequest
  ): Promise<{ success: boolean; data: CADSpreadsheetRow; message?: string }> => {
    const response = await api.put(`/styles/${styleId}/cad-table/row/${rowId}`, data);
    return response.data;
  },

  /**
   * Delete a CAD row from the spreadsheet table
   */
  deleteCADTableRow: async (
    styleId: string,
    rowId: string
  ): Promise<{ success: boolean; message?: string }> => {
    const response = await api.delete(`/styles/${styleId}/cad-table/row/${rowId}`);
    return response.data;
  },

  /**
   * Get available widths for a greige
   */
  getGreigeWidths: async (greigeId: string): Promise<GreigeWidthsResponse> => {
    const response = await api.get(`/styles/cad-table/greige/${greigeId}/widths`);
    return response.data;
  },

  // CAD PURPOSES OPERATIONS (PRODUCTION, PLANNING, COSTING)

  /**
   * Approve a CAD record (any purpose)
   * POST /api/styles/:styleId/cad-table/row/:rowId/approve
   */
  approveCADPurpose: async (
    styleId: string,
    rowId: string,
    data: { approvalNotes?: string }
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      cadId: string;
      purpose: string;
      approvalStatus: string;
      approvedBy: string | null;
      approvedAt: string | null;
    };
  }> => {
    const response = await api.post(`/styles/${styleId}/cad-table/row/${rowId}/approve`, data);
    return response.data;
  },

  /**
   * Reject a CAD record (any purpose)
   * POST /api/styles/:styleId/cad-table/row/:rowId/reject
   */
  rejectCADPurpose: async (
    styleId: string,
    rowId: string,
    data: { rejectionNotes: string }
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      cadId: string;
      purpose: string;
      approvalStatus: string;
      rejectionNotes: string | null;
    };
  }> => {
    const response = await api.post(`/styles/${styleId}/cad-table/row/${rowId}/reject`, data);
    return response.data;
  },

  /**
   * Create new version of PLANNING CAD
   * POST /api/styles/:styleId/cad-table/planning/:rowId/create-version
   */
  createPlanningVersion: async (
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
  }> => {
    const response = await api.post(`/styles/${styleId}/cad-table/planning/${rowId}/create-version`, data);
    return response.data;
  },

  /**
   * Copy CAD between purposes (COSTING→PLANNING, PLANNING→PRODUCTION)
   * POST /api/styles/:styleId/cad-table/copy
   */
  copyCADPurpose: async (
    styleId: string,
    data: {
      sourceCadId: string;
      targetPurpose: string;
      styleFabricId: string;
      componentId?: string;
      patternPartId?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      newCadId: string;
      sourcePurpose: string;
      targetPurpose: string;
    };
  }> => {
    const response = await api.post(`/styles/${styleId}/cad-table/copy`, data);
    return response.data;
  },

  /**
   * Link PRODUCTION CAD to fabric stock
   * POST /api/styles/:styleId/cad-table/link-stock
   */
  linkCADToStock: async (
    styleId: string,
    data: {
      cadId: string;
      fabricStockId: string;
      procurementId?: string;
      planningCadWidth?: number;
    }
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      cadId: string;
      fabricStockId: string;
      cutableWidth: number;
      widthVariance: number | null;
      variancePercent: number | null;
    };
  }> => {
    const response = await api.post(`/styles/${styleId}/cad-table/link-stock`, data);
    return response.data;
  },
};

// Named exports for convenience
export const getAllStyles = styleService.getAllStyles;
export const getStyleById = styleService.getStyleById;
export const createStyle = styleService.createStyle;
export const updateStyle = styleService.updateStyle;
export const deleteStyle = styleService.deleteStyle;
export const canDeactivate = styleService.canDeactivate;
export const permanentDeleteStyle = styleService.permanentDeleteStyle;
export const restoreStyle = styleService.restoreStyle;
export const getDeletedStyles = styleService.getDeletedStyles;

// Deactivation check type
export interface DeactivationCheck {
  canDeactivate: boolean;
  blockers: { type: string; count: number }[];
  message: string;
}
