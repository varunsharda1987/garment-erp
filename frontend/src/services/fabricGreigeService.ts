import axios from 'axios';
import type {
  GreigeMaster,
  FabricMaster,
  FabricWidthCAD,
  GreigeMasterFormData,
  FabricMasterFormData,
  FabricWidthCADFormData,
  PaginatedResponse,
  GreigeStatistics,
  FabricStatistics,
  CADStatistics,
  CostComparison,
} from '../types/fabric-greige.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_PREFIX = '/fabric-management';

// Helper to get auth headers
const getAuthHeaders = () => {
  // Get token from Zustand auth store in localStorage
  const authStorage = localStorage.getItem('auth-storage');
  let token = null;

  if (authStorage) {
    try {
      const parsed = JSON.parse(authStorage);
      token = parsed.state?.token || null;
    } catch (e) {
      console.error('Error parsing auth storage:', e);
    }
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

// ============================================
// GREIGE MASTER SERVICES
// ============================================

export const greigeService = {
  // Get all greige masters with pagination and filters
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    supplierId?: string;
    isActive?: string;
    composition?: string;
    weaveType?: string;
  }): Promise<PaginatedResponse<GreigeMaster>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.isActive) queryParams.append('isActive', params.isActive);
    if (params?.composition) queryParams.append('composition', params.composition);
    if (params?.weaveType) queryParams.append('weaveType', params.weaveType);

    const url = `${API_BASE_URL}${API_PREFIX}/greige${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await axios.get<PaginatedResponse<GreigeMaster>>(url, getAuthHeaders());
    return response.data;
  },

  // Get single greige master by ID
  async getById(id: string): Promise<GreigeMaster> {
    const response = await axios.get<GreigeMaster>(
      `${API_BASE_URL}${API_PREFIX}/greige/${id}`,
      getAuthHeaders()
    );
    return response.data;
  },

  // Create new greige master
  async create(data: GreigeMasterFormData): Promise<GreigeMaster> {
    const response = await axios.post<GreigeMaster>(
      `${API_BASE_URL}${API_PREFIX}/greige`,
      data,
      getAuthHeaders()
    );
    return response.data;
  },

  // Update greige master
  async update(id: string, data: Partial<GreigeMasterFormData>): Promise<GreigeMaster> {
    const response = await axios.put<GreigeMaster>(
      `${API_BASE_URL}${API_PREFIX}/greige/${id}`,
      data,
      getAuthHeaders()
    );
    return response.data;
  },

  // Delete greige master
  async delete(id: string): Promise<{ message: string }> {
    const response = await axios.delete<{ message: string }>(
      `${API_BASE_URL}${API_PREFIX}/greige/${id}`,
      getAuthHeaders()
    );
    return response.data;
  },

  // Get greige statistics
  async getStatistics(): Promise<GreigeStatistics> {
    const response = await axios.get<GreigeStatistics>(
      `${API_BASE_URL}${API_PREFIX}/greige/statistics`,
      getAuthHeaders()
    );
    return response.data;
  },
};

// ============================================
// FABRIC MASTER SERVICES
// ============================================

export const fabricService = {
  // Get all fabric masters with pagination and filters
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    greigeId?: string;
    supplierId?: string;
    isActive?: string;
    colorName?: string;
    finishType?: string;
  }): Promise<PaginatedResponse<FabricMaster>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.greigeId) queryParams.append('greigeId', params.greigeId);
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.isActive) queryParams.append('isActive', params.isActive);
    if (params?.colorName) queryParams.append('colorName', params.colorName);
    if (params?.finishType) queryParams.append('finishType', params.finishType);

    const url = `${API_BASE_URL}${API_PREFIX}/fabric${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await axios.get<PaginatedResponse<FabricMaster>>(url, getAuthHeaders());
    return response.data;
  },

  // Get single fabric master by ID
  async getById(id: string): Promise<FabricMaster> {
    const response = await axios.get<FabricMaster>(
      `${API_BASE_URL}${API_PREFIX}/fabric/${id}`,
      getAuthHeaders()
    );
    return response.data;
  },

  // Get fabrics by greige ID
  async getByGreigeId(greigeId: string): Promise<FabricMaster[]> {
    const response = await axios.get<FabricMaster[]>(
      `${API_BASE_URL}${API_PREFIX}/fabric/by-greige/${greigeId}`,
      getAuthHeaders()
    );
    return response.data;
  },

  // Create new fabric master
  async create(data: FabricMasterFormData): Promise<FabricMaster> {
    const response = await axios.post<FabricMaster>(
      `${API_BASE_URL}${API_PREFIX}/fabric`,
      data,
      getAuthHeaders()
    );
    return response.data;
  },

  // Update fabric master
  async update(id: string, data: Partial<FabricMasterFormData>): Promise<FabricMaster> {
    const response = await axios.put<FabricMaster>(
      `${API_BASE_URL}${API_PREFIX}/fabric/${id}`,
      data,
      getAuthHeaders()
    );
    return response.data;
  },

  // Delete fabric master
  async delete(id: string): Promise<{ message: string; deletedCADs: number }> {
    const response = await axios.delete<{ message: string; deletedCADs: number }>(
      `${API_BASE_URL}${API_PREFIX}/fabric/${id}`,
      getAuthHeaders()
    );
    return response.data;
  },

  // Get fabric statistics
  async getStatistics(): Promise<FabricStatistics> {
    const response = await axios.get<FabricStatistics>(
      `${API_BASE_URL}${API_PREFIX}/fabric/statistics`,
      getAuthHeaders()
    );
    return response.data;
  },
};

// ============================================
// CAD WIDTH SERVICES
// ============================================

export const cadService = {
  // Get all CAD entries for a fabric
  async getByFabricId(fabricId: string): Promise<FabricWidthCAD[]> {
    const response = await axios.get<FabricWidthCAD[]>(
      `${API_BASE_URL}${API_PREFIX}/cad/fabric/${fabricId}`,
      getAuthHeaders()
    );
    return response.data;
  },

  // Get single CAD entry by ID
  async getById(id: string): Promise<FabricWidthCAD> {
    const response = await axios.get<FabricWidthCAD>(
      `${API_BASE_URL}${API_PREFIX}/cad/${id}`,
      getAuthHeaders()
    );
    return response.data;
  },

  // Create new CAD entry
  async create(data: FabricWidthCADFormData): Promise<FabricWidthCAD> {
    const response = await axios.post<FabricWidthCAD>(
      `${API_BASE_URL}${API_PREFIX}/cad`,
      data,
      getAuthHeaders()
    );
    return response.data;
  },

  // Update CAD entry
  async update(id: string, data: Partial<FabricWidthCADFormData>): Promise<FabricWidthCAD> {
    const response = await axios.put<FabricWidthCAD>(
      `${API_BASE_URL}${API_PREFIX}/cad/${id}`,
      data,
      getAuthHeaders()
    );
    return response.data;
  },

  // Set as preferred width
  async setPreferred(id: string): Promise<FabricWidthCAD> {
    const response = await axios.patch<FabricWidthCAD>(
      `${API_BASE_URL}${API_PREFIX}/cad/${id}/set-preferred`,
      {},
      getAuthHeaders()
    );
    return response.data;
  },

  // Delete CAD entry
  async delete(id: string): Promise<{ message: string }> {
    const response = await axios.delete<{ message: string }>(
      `${API_BASE_URL}${API_PREFIX}/cad/${id}`,
      getAuthHeaders()
    );
    return response.data;
  },

  // Get cost comparison for a fabric
  async getCostComparison(fabricId: string, orderQuantity: number = 1000): Promise<CostComparison> {
    const response = await axios.get<CostComparison>(
      `${API_BASE_URL}${API_PREFIX}/cad/comparison/${fabricId}?orderQuantity=${orderQuantity}`,
      getAuthHeaders()
    );
    return response.data;
  },

  // Get CAD statistics
  async getStatistics(): Promise<CADStatistics> {
    const response = await axios.get<CADStatistics>(
      `${API_BASE_URL}${API_PREFIX}/cad/statistics`,
      getAuthHeaders()
    );
    return response.data;
  },
};

// Export all services as a single object
export default {
  greige: greigeService,
  fabric: fabricService,
  cad: cadService,
};
