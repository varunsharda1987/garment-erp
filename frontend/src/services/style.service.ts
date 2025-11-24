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
    stage?: string
  ): Promise<StylesListResponse> => {
    let url = `/styles?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (stage) {
      url += `&stage=${stage}`;
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
   * Delete (deactivate) style
   */
  deleteStyle: async (id: string): Promise<void> => {
    await api.delete(`/styles/${id}`);
  },

  /**
   * Upload style image
   */
  uploadStyleImage: async (id: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post<StyleResponse>(`/styles/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.imageUrl || '';
  },

  /**
   * Create or update style variants
   */
  createStyleVariants: async (
    styleId: string,
    variants: Array<{ size: string; sku: string; barcode?: string; isActive: boolean }>
  ): Promise<any> => {
    const response = await api.post(`/styles/${styleId}/variants`, { variants });
    return response.data;
  },

  // ============================================
  // DRAFT OPERATIONS
  // ============================================

  /**
   * Get all draft styles
   */
  getAllDrafts: async (params?: { page?: number; limit?: number }): Promise<any> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await api.get(`/styles/drafts?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get a single draft by ID
   */
  getDraftById: async (id: string): Promise<any> => {
    const response = await api.get(`/styles/drafts/${id}`);
    return response.data;
  },

  /**
   * Save draft (same as createStyle, but status will be DRAFT by default)
   */
  saveDraft: async (data: any): Promise<any> => {
    // If data has an ID, update it; otherwise create new draft
    if (data.id) {
      const response = await api.put(`/styles/${data.id}`, { ...data, status: 'DRAFT' });
      return response.data;
    } else {
      const response = await api.post('/styles', { ...data, status: 'DRAFT' });
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
  publishDraft: async (id: string): Promise<any> => {
    const response = await api.post(`/styles/${id}/publish`);
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
};

// Named exports for convenience
export const getAllStyles = styleService.getAllStyles;
export const getStyleById = styleService.getStyleById;
export const createStyle = styleService.createStyle;
export const updateStyle = styleService.updateStyle;
export const deleteStyle = styleService.deleteStyle;
