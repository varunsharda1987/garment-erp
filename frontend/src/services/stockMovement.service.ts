// Stock Movement Service - API calls for stock transactions
import api from '@/lib/api';
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

const BASE_URL = '/stock-movements';

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

    const response = await api.get<ApiResponse<StockMovement[]>>(
      `${BASE_URL}${params.toString() ? '?' + params.toString() : ''}`
    );
    return response.data.data || [];
  },

  /**
   * Get stock movement by ID
   */
  async getById(id: string): Promise<StockMovement> {
    const response = await api.get<ApiResponse<StockMovement>>(`${BASE_URL}/${id}`);
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

    const response = await api.get<ApiResponse<StockMovement[]>>(
      `${BASE_URL}/material/${materialId}/history${params.toString() ? '?' + params.toString() : ''}`
    );
    return response.data.data || [];
  },

  /**
   * Get movement summary for warehouse
   */
  async getMovementSummary(warehouseId: string, startDate: string, endDate: string): Promise<MovementSummary> {
    const response = await api.get<ApiResponse<MovementSummary>>(
      `${BASE_URL}/summary/${warehouseId}?startDate=${startDate}&endDate=${endDate}`
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

    const response = await api.get<ApiResponse<StockTransaction[]>>(
      `${BASE_URL}/ledger/${materialId}/${warehouseId}${params.toString() ? '?' + params.toString() : ''}`
    );
    return response.data.data || [];
  },

  /**
   * Create stock IN (receipt)
   */
  async createStockIn(data: CreateStockInDTO): Promise<StockMovement> {
    const response = await api.post<ApiResponse<StockMovement>>(`${BASE_URL}/stock-in`, data);
    if (!response.data.data) throw new Error('Failed to create stock in');
    return response.data.data;
  },

  /**
   * Create bulk stock IN (multiple items in single transaction)
   */
  async createBulkStockIn(data: {
    warehouseId: string;
    supplierId?: string;
    referenceType?: string;
    referenceNumber?: string;
    remarks?: string;
    items: Array<{
      materialId?: string;
      itemType?: string;
      itemId?: string;
      quantity: number;
      unit: string;
      rate?: number;
      foldLengthCm?: number;
      thanCount?: number;
      remarks?: string;
    }>;
  }): Promise<{ batchId: string; movements: StockMovement[]; itemCount: number; totalQuantity: string }> {
    const response = await api.post<
      ApiResponse<{ batchId: string; movements: StockMovement[]; itemCount: number; totalQuantity: string }>
    >(`${BASE_URL}/bulk-stock-in`, data);
    if (!response.data.data) throw new Error('Failed to create bulk stock in');
    return response.data.data;
  },

  /**
   * Create stock OUT (issue)
   */
  async createStockOut(data: CreateStockOutDTO): Promise<StockMovement> {
    const response = await api.post<ApiResponse<StockMovement>>(`${BASE_URL}/stock-out`, data);
    if (!response.data.data) throw new Error('Failed to create stock out');
    return response.data.data;
  },

  /**
   * Create stock transfer
   */
  async createTransfer(
    data: CreateStockTransferDTO
  ): Promise<{ transferOut: StockMovement; transferIn: StockMovement }> {
    const response = await api.post<ApiResponse<{ transferOut: StockMovement; transferIn: StockMovement }>>(
      `${BASE_URL}/transfer`,
      data
    );
    if (!response.data.data) throw new Error('Failed to create stock transfer');
    return response.data.data;
  },

  /**
   * Create stock adjustment
   */
  async createAdjustment(data: CreateStockAdjustmentDTO): Promise<StockMovement> {
    const response = await api.post<ApiResponse<StockMovement>>(`${BASE_URL}/adjustment`, data);
    if (!response.data.data) throw new Error('Failed to create stock adjustment');
    return response.data.data;
  },

  /**
   * Create stock IN from processor return (partial receipt - consumes from processor's greige stock)
   */
  async createStockInFromProcessor(data: {
    greigeStockId: string;
    receivedQuantity: number;
    warehouseId: string;
    remarks?: string;
  }): Promise<{ receivedQuantity: number; remainingAtProcessor: number }> {
    const response = await api.post<ApiResponse<{ receivedQuantity: number; remainingAtProcessor: number }>>(
      `${BASE_URL}/processor-return`,
      data
    );
    if (!response.data.data) throw new Error('Failed to process processor return');
    return response.data.data;
  },

  /**
   * Get unified material movements from all sources
   */
  async getUnifiedMovements(filters?: {
    supplierId?: string;
    invoiceNumber?: string;
    direction?: 'INWARD' | 'OUTWARD' | 'TRANSFER' | 'ADJUSTMENT';
    materialType?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: UnifiedMovement[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (filters?.supplierId) params.append('supplierId', filters.supplierId);
    if (filters?.invoiceNumber) params.append('invoiceNumber', filters.invoiceNumber);
    if (filters?.direction) params.append('direction', filters.direction);
    if (filters?.materialType) params.append('materialType', filters.materialType);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await api.get<{
      success: boolean;
      data: UnifiedMovement[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`${BASE_URL}/unified${params.toString() ? '?' + params.toString() : ''}`);
    return {
      data: response.data.data || [],
      pagination: response.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
    };
  },
};

// Unified Movement Type
export interface UnifiedMovement {
  id: string;
  date: string;
  direction: 'INWARD' | 'OUTWARD' | 'TRANSFER' | 'ADJUSTMENT';
  supplierName: string | null;
  supplierCode: string | null;
  materialName: string;
  materialCode: string;
  quantity: number;
  unit: string;
  invoiceNumber: string | null;
  rate: number | null;
  totalValue: number | null;
  sourceType: 'STOCK_MOVEMENT' | 'GREIGE_STOCK' | 'FABRIC_STOCK' | 'GRN' | 'PROCUREMENT' | 'CHALLAN';
  sourceId: string;
  sourceNumber: string;
}

// Pending Inward Item (unified dashboard)
export interface PendingInwardItem {
  id: string;
  documentNumber: string;
  sourceType: string;
  sourceId: string;
  partyId: string;
  partyCode: string;
  partyName: string;
  partyType: 'SUPPLIER' | 'PROCESSOR';
  materialDescription: string;
  qtyOrdered: number;
  qtyCompleted: number;
  qtyPending: number;
  unit: string;
  documentDate: string;
  expectedDate: string | null;
  daysOut: number | null;
  isOverdue: boolean;
  actionRoute: string;
  actionLabel: string;
}

// Pending Outward Item (unified dashboard)
export interface PendingOutwardItem {
  id: string;
  documentNumber: string;
  sourceType: string;
  sourceId: string;
  partyId: string;
  partyCode: string;
  partyName: string;
  materialDescription: string;
  quantity: number;
  unit: string;
  createdDate: string;
  actionRoute: string;
  actionLabel: string;
}

// Dashboard Summary
export interface DashboardSummary {
  date: string;
  received: {
    total: number;
    grn: number;
    dyeing: number;
    printing: number;
    external: number;
  };
  sent: {
    total: number;
    challans: number;
    dyeing: number;
    printing: number;
    external: number;
  };
  overdue: {
    total: number;
  };
}

// Source type options for filters
export const SOURCE_TYPES = [
  { value: 'PURCHASE', label: 'Purchase PO' },
  { value: 'DYEING', label: 'Dyeing' },
  { value: 'PRINTING', label: 'Printing' },
  { value: 'LACE_PROCESSING', label: 'Lace Processing' },
  { value: 'EMBROIDERY_FABRIC', label: 'Embroidery (Fabric)' },
  { value: 'EMBROIDERY_PIECE', label: 'Embroidery (Piece)' },
  { value: 'SMOCKING', label: 'Smocking' },
  { value: 'HANDWORK', label: 'Handwork' },
];

// Extended service methods for dashboard
export const stockMovementDashboardService = {
  /**
   * Get pending inward items across all external sources
   */
  async getPendingInward(filters?: {
    sourceType?: string;
    processorId?: string;
    overdueOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    data: PendingInwardItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (filters?.sourceType) params.append('sourceType', filters.sourceType);
    if (filters?.processorId) params.append('processorId', filters.processorId);
    if (filters?.overdueOnly) params.append('overdueOnly', 'true');
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await api.get<{
      success: boolean;
      data: PendingInwardItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`${BASE_URL}/pending-inward${params.toString() ? '?' + params.toString() : ''}`);
    return {
      data: response.data.data || [],
      pagination: response.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
    };
  },

  /**
   * Get pending outward items (drafts awaiting send)
   */
  async getPendingOutward(filters?: {
    sourceType?: string;
    processorId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: PendingOutwardItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (filters?.sourceType) params.append('sourceType', filters.sourceType);
    if (filters?.processorId) params.append('processorId', filters.processorId);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await api.get<{
      success: boolean;
      data: PendingOutwardItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`${BASE_URL}/pending-outward${params.toString() ? '?' + params.toString() : ''}`);
    return {
      data: response.data.data || [],
      pagination: response.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
    };
  },

  /**
   * Get today's dashboard summary
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const response = await api.get<{ success: boolean; data: DashboardSummary }>(`${BASE_URL}/dashboard-summary`);
    return response.data.data;
  },
};

export default stockMovementService;
