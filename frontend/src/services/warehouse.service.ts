// Warehouse Service - API calls for warehouse management
import api from '@/lib/api';
import type {
  Warehouse,
  CreateWarehouseDTO,
  UpdateWarehouseDTO,
  WarehouseStockSummary,
  WarehouseFilters,
  ApiResponse,
} from '../types/inventory.types';

const BASE_URL = '/warehouses';

export const warehouseService = {
  /**
   * Get all warehouses with optional filters
   */
  async getAll(filters?: WarehouseFilters): Promise<Warehouse[]> {
    const params = new URLSearchParams();
    if (filters?.warehouseType) params.append('warehouseType', filters.warehouseType);
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters?.search) params.append('search', filters.search);

    const response = await api.get<ApiResponse<Warehouse[]>>(
      `${BASE_URL}${params.toString() ? '?' + params.toString() : ''}`
    );
    return response.data.data || [];
  },

  /**
   * Get warehouse by ID
   */
  async getById(id: string): Promise<Warehouse> {
    const response = await api.get<ApiResponse<Warehouse>>(`${BASE_URL}/${id}`);
    if (!response.data.data) throw new Error('Warehouse not found');
    return response.data.data;
  },

  /**
   * Get warehouse by code
   */
  async getByCode(code: string): Promise<Warehouse> {
    const response = await api.get<ApiResponse<Warehouse>>(`${BASE_URL}/code/${code}`);
    if (!response.data.data) throw new Error('Warehouse not found');
    return response.data.data;
  },

  /**
   * Get warehouses by type
   */
  async getByType(type: string): Promise<Warehouse[]> {
    const response = await api.get<ApiResponse<Warehouse[]>>(`${BASE_URL}/by-type/${type}`);
    return response.data.data || [];
  },

  /**
   * Generate warehouse code
   */
  async generateCode(type: string): Promise<string> {
    const response = await api.get<ApiResponse<{ warehouseCode: string }>>(`${BASE_URL}/generate-code/${type}`);
    return response.data.data?.warehouseCode || '';
  },

  /**
   * Get warehouse stock summary
   */
  async getStockSummary(id: string): Promise<WarehouseStockSummary> {
    const response = await api.get<ApiResponse<WarehouseStockSummary>>(`${BASE_URL}/${id}/stock-summary`);
    return response.data.data || { totalMaterials: 0, totalValue: 0 };
  },

  /**
   * Create new warehouse
   */
  async create(data: CreateWarehouseDTO): Promise<Warehouse> {
    const response = await api.post<ApiResponse<Warehouse>>(BASE_URL, data);
    if (!response.data.data) throw new Error('Failed to create warehouse');
    return response.data.data;
  },

  /**
   * Update warehouse
   */
  async update(id: string, data: UpdateWarehouseDTO): Promise<Warehouse> {
    const response = await api.put<ApiResponse<Warehouse>>(`${BASE_URL}/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update warehouse');
    return response.data.data;
  },

  /**
   * Delete warehouse (soft delete)
   */
  async delete(id: string): Promise<void> {
    await api.delete(`${BASE_URL}/${id}`);
  },
};

export default warehouseService;
