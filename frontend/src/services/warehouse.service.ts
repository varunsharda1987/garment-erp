// Warehouse Service - API calls for warehouse management
import axios from 'axios';
import type {
  Warehouse,
  CreateWarehouseDTO,
  UpdateWarehouseDTO,
  WarehouseStockSummary,
  WarehouseFilters,
  ApiResponse
} from '../types/inventory.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/warehouses`;

// Helper to get auth token
const getAuthHeader = () => {
  // Get token from Zustand persisted storage
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const { state } = JSON.parse(authStorage);
      const token = state?.token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }
  return {};
};

export const warehouseService = {
  /**
   * Get all warehouses with optional filters
   */
  async getAll(filters?: WarehouseFilters): Promise<Warehouse[]> {
    const params = new URLSearchParams();
    if (filters?.warehouseType) params.append('warehouseType', filters.warehouseType);
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    if (filters?.search) params.append('search', filters.search);

    const response = await axios.get<ApiResponse<Warehouse[]>>(
      `${BASE_URL}${params.toString() ? '?' + params.toString() : ''}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Get warehouse by ID
   */
  async getById(id: string): Promise<Warehouse> {
    const response = await axios.get<ApiResponse<Warehouse>>(
      `${BASE_URL}/${id}`,
      { headers: getAuthHeader() }
    );
    if (!response.data.data) throw new Error('Warehouse not found');
    return response.data.data;
  },

  /**
   * Get warehouse by code
   */
  async getByCode(code: string): Promise<Warehouse> {
    const response = await axios.get<ApiResponse<Warehouse>>(
      `${BASE_URL}/code/${code}`,
      { headers: getAuthHeader() }
    );
    if (!response.data.data) throw new Error('Warehouse not found');
    return response.data.data;
  },

  /**
   * Get warehouses by type
   */
  async getByType(type: string): Promise<Warehouse[]> {
    const response = await axios.get<ApiResponse<Warehouse[]>>(
      `${BASE_URL}/by-type/${type}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Generate warehouse code
   */
  async generateCode(type: string): Promise<string> {
    const response = await axios.get<ApiResponse<{ warehouseCode: string }>>(
      `${BASE_URL}/generate-code/${type}`,
      { headers: getAuthHeader() }
    );
    return response.data.data?.warehouseCode || '';
  },

  /**
   * Get warehouse stock summary
   */
  async getStockSummary(id: string): Promise<WarehouseStockSummary> {
    const response = await axios.get<ApiResponse<WarehouseStockSummary>>(
      `${BASE_URL}/${id}/stock-summary`,
      { headers: getAuthHeader() }
    );
    return response.data.data || { totalMaterials: 0, totalValue: 0 };
  },

  /**
   * Create new warehouse
   */
  async create(data: CreateWarehouseDTO): Promise<Warehouse> {
    const response = await axios.post<ApiResponse<Warehouse>>(
      BASE_URL,
      data,
      { headers: getAuthHeader() }
    );
    if (!response.data.data) throw new Error('Failed to create warehouse');
    return response.data.data;
  },

  /**
   * Update warehouse
   */
  async update(id: string, data: UpdateWarehouseDTO): Promise<Warehouse> {
    const response = await axios.put<ApiResponse<Warehouse>>(
      `${BASE_URL}/${id}`,
      data,
      { headers: getAuthHeader() }
    );
    if (!response.data.data) throw new Error('Failed to update warehouse');
    return response.data.data;
  },

  /**
   * Delete warehouse (soft delete)
   */
  async delete(id: string): Promise<void> {
    await axios.delete(
      `${BASE_URL}/${id}`,
      { headers: getAuthHeader() }
    );
  }
};

export default warehouseService;
