// Stock Movement Service - API calls for stock transactions
import axios from 'axios';
import type {
  StockMovement,
  CreateStockInDTO,
  CreateStockOutDTO,
  CreateStockTransferDTO,
  CreateStockAdjustmentDTO,
  MovementSummary,
  StockTransaction,
  StockMovementFilters,
  ApiResponse,
} from '../types/inventory.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/stock-movements`;

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

export const stockMovementService = {
  /**
   * Get all stock movements with optional filters
   */
  async getAll(filters?: StockMovementFilters): Promise<StockMovement[]> {
    const params = new URLSearchParams();
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId);
    if (filters?.materialId) params.append('materialId', filters.materialId);
    if (filters?.movementType) params.append('movementType', filters.movementType);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await axios.get<ApiResponse<StockMovement[]>>(
      `${BASE_URL}${params.toString() ? '?' + params.toString() : ''}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Get stock movement by ID
   */
  async getById(id: string): Promise<StockMovement> {
    const response = await axios.get<ApiResponse<StockMovement>>(`${BASE_URL}/${id}`, { headers: getAuthHeader() });
    if (!response.data.data) throw new Error('Stock movement not found');
    return response.data.data;
  },

  /**
   * Get material movement history
   */
  async getMaterialHistory(
    materialId: string,
    warehouseId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<StockMovement[]> {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await axios.get<ApiResponse<StockMovement[]>>(
      `${BASE_URL}/material/${materialId}/history${params.toString() ? '?' + params.toString() : ''}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Get movement summary for warehouse
   */
  async getMovementSummary(warehouseId: string, startDate: string, endDate: string): Promise<MovementSummary> {
    const response = await axios.get<ApiResponse<MovementSummary>>(
      `${BASE_URL}/summary/${warehouseId}?startDate=${startDate}&endDate=${endDate}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || { totalIn: 0, totalOut: 0, totalTransfer: 0, netChange: 0 };
  },

  /**
   * Get stock ledger for material in warehouse
   */
  async getStockLedger(
    materialId: string,
    warehouseId: string,
    startDate?: string,
    endDate?: string
  ): Promise<StockTransaction[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await axios.get<ApiResponse<StockTransaction[]>>(
      `${BASE_URL}/ledger/${materialId}/${warehouseId}${params.toString() ? '?' + params.toString() : ''}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Create stock IN (receipt)
   */
  async createStockIn(data: CreateStockInDTO): Promise<StockMovement> {
    const response = await axios.post<ApiResponse<StockMovement>>(`${BASE_URL}/stock-in`, data, {
      headers: getAuthHeader(),
    });
    if (!response.data.data) throw new Error('Failed to create stock in');
    return response.data.data;
  },

  /**
   * Create stock OUT (issue)
   */
  async createStockOut(data: CreateStockOutDTO): Promise<StockMovement> {
    const response = await axios.post<ApiResponse<StockMovement>>(`${BASE_URL}/stock-out`, data, {
      headers: getAuthHeader(),
    });
    if (!response.data.data) throw new Error('Failed to create stock out');
    return response.data.data;
  },

  /**
   * Create stock transfer
   */
  async createTransfer(
    data: CreateStockTransferDTO
  ): Promise<{ transferOut: StockMovement; transferIn: StockMovement }> {
    const response = await axios.post<ApiResponse<{ transferOut: StockMovement; transferIn: StockMovement }>>(
      `${BASE_URL}/transfer`,
      data,
      { headers: getAuthHeader() }
    );
    if (!response.data.data) throw new Error('Failed to create stock transfer');
    return response.data.data;
  },

  /**
   * Create stock adjustment
   */
  async createAdjustment(data: CreateStockAdjustmentDTO): Promise<StockMovement> {
    const response = await axios.post<ApiResponse<StockMovement>>(`${BASE_URL}/adjustment`, data, {
      headers: getAuthHeader(),
    });
    if (!response.data.data) throw new Error('Failed to create stock adjustment');
    return response.data.data;
  },
};

export default stockMovementService;
