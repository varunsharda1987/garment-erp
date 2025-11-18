// Stock Level Service - API calls for stock inquiry
import axios from 'axios';
import type {
  StockLevel,
  UpdateStockLevelDTO,
  StockValuationReport,
  StockAgingReport,
  StockLevelFilters,
  ApiResponse
} from '../types/inventory.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/stock-levels`;

const getAuthHeader = () => {
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const { state } = JSON.parse(authStorage);
      return state?.token ? { Authorization: `Bearer ${state.token}` } : {};
    } catch {
      return {};
    }
  }
  return {};
};

export const stockLevelService = {
  /**
   * Get all stock levels with optional filters
   */
  async getAll(filters?: StockLevelFilters): Promise<StockLevel[]> {
    const params = new URLSearchParams();
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId);
    if (filters?.materialId) params.append('materialId', filters.materialId);
    if (filters?.belowReorderLevel) params.append('belowReorderLevel', 'true');
    if (filters?.search) params.append('search', filters.search);

    const response = await axios.get<ApiResponse<StockLevel[]>>(
      `${BASE_URL}${params.toString() ? '?' + params.toString() : ''}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Get stock level by ID
   */
  async getById(id: string): Promise<StockLevel> {
    const response = await axios.get<ApiResponse<StockLevel>>(
      `${BASE_URL}/${id}`,
      { headers: getAuthHeader() }
    );
    if (!response.data.data) throw new Error('Stock level not found');
    return response.data.data;
  },

  /**
   * Get stock levels for a material (across all warehouses)
   */
  async getByMaterial(materialId: string): Promise<StockLevel[]> {
    const response = await axios.get<ApiResponse<StockLevel[]>>(
      `${BASE_URL}/material/${materialId}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Get stock levels for a warehouse
   */
  async getByWarehouse(warehouseId: string): Promise<StockLevel[]> {
    const response = await axios.get<ApiResponse<StockLevel[]>>(
      `${BASE_URL}/warehouse/${warehouseId}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Get materials below reorder level
   */
  async getBelowReorderLevel(warehouseId?: string): Promise<StockLevel[]> {
    const params = warehouseId ? `?warehouseId=${warehouseId}` : '';
    const response = await axios.get<ApiResponse<StockLevel[]>>(
      `${BASE_URL}/below-reorder${params}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Get stock aging report
   */
  async getAgingReport(warehouseId: string): Promise<StockAgingReport[]> {
    const response = await axios.get<ApiResponse<StockAgingReport[]>>(
      `${BASE_URL}/aging/${warehouseId}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Get stock valuation report
   */
  async getValuationReport(warehouseId?: string, materialId?: string): Promise<StockValuationReport> {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (materialId) params.append('materialId', materialId);

    const response = await axios.get<ApiResponse<StockValuationReport>>(
      `${BASE_URL}/valuation${params.toString() ? '?' + params.toString() : ''}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || { totalValue: 0, totalQuantity: 0, items: [] };
  },

  /**
   * Update stock level (reorder levels only)
   */
  async update(id: string, data: UpdateStockLevelDTO): Promise<StockLevel> {
    const response = await axios.put<ApiResponse<StockLevel>>(
      `${BASE_URL}/${id}`,
      data,
      { headers: getAuthHeader() }
    );
    if (!response.data.data) throw new Error('Failed to update stock level');
    return response.data.data;
  }
};

export default stockLevelService;
