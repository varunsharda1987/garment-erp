import api from '../lib/api';
import { MaterialType } from '../types/material-master.types';
import type {
  MaterialMaster,
  CreateMaterialMasterDto,
  UpdateMaterialMasterDto,
  MaterialMasterFilterDto,
  MaterialSupplierMapping,
  MaterialSupplierMappingDto,
} from '../types/material-master.types';

/**
 * Unified Material Master Service
 * Handles all material types through a single API endpoint
 * Replaces 31 individual material services (lace, button, thread, etc.)
 */

const BASE_URL = '/material-master';

export const materialMasterService = {
  /**
   * Get all materials with optional filters
   */
  getAll: async (filters?: MaterialMasterFilterDto): Promise<MaterialMaster[]> => {
    const params = new URLSearchParams();

    if (filters?.type) {
      params.append('type', filters.type);
    }
    if (filters?.active !== undefined) {
      params.append('active', filters.active.toString());
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.supplierId) {
      params.append('supplierId', filters.supplierId.toString());
    }

    const queryString = params.toString();
    const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;

    const response = await api.get<MaterialMaster[]>(url);
    return response.data;
  },

  /**
   * Get single material by ID
   */
  getById: async (id: number): Promise<MaterialMaster> => {
    const response = await api.get<MaterialMaster>(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Create new material
   */
  create: async (data: CreateMaterialMasterDto): Promise<MaterialMaster> => {
    const response = await api.post<MaterialMaster>(BASE_URL, data);
    return response.data;
  },

  /**
   * Update material
   */
  update: async (id: number, data: UpdateMaterialMasterDto): Promise<MaterialMaster> => {
    const response = await api.put<MaterialMaster>(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  /**
   * Delete material (soft delete)
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`${BASE_URL}/${id}`);
  },

  /**
   * Get all material types enum
   */
  getTypes: async (): Promise<MaterialType[]> => {
    const response = await api.get<MaterialType[]>(`${BASE_URL}/types`);
    return response.data;
  },

  /**
   * Get material count by type
   */
  getCountByType: async (type: MaterialType): Promise<{ type: string; count: number }> => {
    const response = await api.get<{ type: string; count: number }>(
      `${BASE_URL}/types/${type}/count`
    );
    return response.data;
  },

  /**
   * Get suppliers for a material
   */
  getSuppliers: async (materialId: number): Promise<MaterialSupplierMapping[]> => {
    const response = await api.get<MaterialSupplierMapping[]>(
      `${BASE_URL}/${materialId}/suppliers`
    );
    return response.data;
  },

  /**
   * Add supplier to material
   */
  addSupplier: async (
    materialId: number,
    data: MaterialSupplierMappingDto
  ): Promise<MaterialSupplierMapping> => {
    const response = await api.post<MaterialSupplierMapping>(
      `${BASE_URL}/${materialId}/suppliers`,
      data
    );
    return response.data;
  },
};

export default materialMasterService;
