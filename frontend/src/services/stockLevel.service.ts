// Stock Level Service - API calls for stock inquiry
import api from '@/lib/api';
import type {
  StockLevel,
  UpdateStockLevelDTO,
  StockValuationReport,
  StockAgingReport,
  StockLevelFilters,
  ApiResponse,
} from '../types/inventory.types';

const BASE_URL = '/stock-levels';

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

    const response = await api.get<ApiResponse<StockLevel[]>>(
      `${BASE_URL}${params.toString() ? '?' + params.toString() : ''}`
    );
    return response.data.data || [];
  },

  /**
   * Get stock level by ID
   */
  async getById(id: string): Promise<StockLevel> {
    const response = await api.get<ApiResponse<StockLevel>>(`${BASE_URL}/${id}`);
    if (!response.data.data) throw new Error('Stock level not found');
    return response.data.data;
  },

  /**
   * Get stock levels for a material (across all warehouses)
   */
  async getByMaterial(materialId: string): Promise<StockLevel[]> {
    const response = await api.get<ApiResponse<StockLevel[]>>(`${BASE_URL}/material/${materialId}`);
    return response.data.data || [];
  },

  /**
   * Get stock levels for a warehouse
   */
  async getByWarehouse(warehouseId: string): Promise<StockLevel[]> {
    const response = await api.get<ApiResponse<StockLevel[]>>(`${BASE_URL}/warehouse/${warehouseId}`);
    return response.data.data || [];
  },

  /**
   * Get materials below reorder level
   */
  async getBelowReorderLevel(warehouseId?: string): Promise<StockLevel[]> {
    const params = warehouseId ? `?warehouseId=${warehouseId}` : '';
    const response = await api.get<ApiResponse<StockLevel[]>>(`${BASE_URL}/below-reorder${params}`);
    return response.data.data || [];
  },

  /**
   * Get stock aging report
   */
  async getAgingReport(warehouseId: string): Promise<StockAgingReport[]> {
    const response = await api.get<ApiResponse<StockAgingReport[]>>(`${BASE_URL}/aging/${warehouseId}`);
    return response.data.data || [];
  },

  /**
   * Get stock valuation report
   */
  async getValuationReport(warehouseId?: string, materialId?: string): Promise<StockValuationReport> {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (materialId) params.append('materialId', materialId);

    const response = await api.get<ApiResponse<StockValuationReport>>(
      `${BASE_URL}/valuation${params.toString() ? '?' + params.toString() : ''}`
    );
    return response.data.data || { totalValue: 0, totalQuantity: 0, items: [] };
  },

  /**
   * Update stock level (reorder levels only)
   */
  async update(id: string, data: UpdateStockLevelDTO): Promise<StockLevel> {
    const response = await api.put<ApiResponse<StockLevel>>(`${BASE_URL}/${id}`, data);
    if (!response.data.data) throw new Error('Failed to update stock level');
    return response.data.data;
  },

  /**
   * Get stock levels filtered by material type
   */
  async getByMaterialType(materialType: string): Promise<StockLevel[]> {
    const response = await api.get<ApiResponse<StockLevel[]>>(`${BASE_URL}/by-type/${materialType}`);
    return response.data.data || [];
  },

  /**
   * Get stock summary grouped by material type
   */
  async getSummaryByType(): Promise<StockSummaryByType[]> {
    const response = await api.get<ApiResponse<StockSummaryByType[]>>(`${BASE_URL}/summary-by-type`);
    return response.data.data || [];
  },
};

export interface StockSummaryByType {
  materialType: string;
  totalRecords: number;
  totalQuantity: number;
  totalValue: number;
}

export default stockLevelService;
