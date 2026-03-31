// Work Order Service - API calls for production planning & work order management
import axios from 'axios';
import type {
  WorkOrder,
  CreateWorkOrderDTO,
  UpdateWorkOrderDTO,
  CreateProductionTrackingDTO,
  WorkOrderFilters,
  ProductionDashboardSummary,
  WorkOrderResponse,
  WorkOrderListResponse,
  ProductionDashboardResponse,
  ProductionTrackingResponse,
  ProductionTracking,
  SplitWorkOrderDTO,
  FabricIssuanceData,
  IssueFabricRequest,
  MaterialIssuanceData,
  IssueMaterialsRequest,
  ThreadIssuanceData,
  IssueThreadRequest,
  WipSummary,
} from '../types/production.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/work-orders`;

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

export const workOrderService = {
  /**
   * Get all work orders with optional filters
   */
  async getAll(filters?: WorkOrderFilters): Promise<WorkOrder[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId);
    if (filters?.styleId) params.append('styleId', filters.styleId);
    if (filters?.orderId) params.append('orderId', filters.orderId);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await axios.get<WorkOrderListResponse>(
      `${BASE_URL}${params.toString() ? '?' + params.toString() : ''}`,
      { headers: getAuthHeader() }
    );
    return response.data.data || [];
  },

  /**
   * Get work order by ID
   */
  async getById(id: string): Promise<WorkOrder> {
    const response = await axios.get<WorkOrderResponse>(`${BASE_URL}/${id}`, { headers: getAuthHeader() });
    if (!response.data.data) throw new Error('Work order not found');
    return response.data.data;
  },

  /**
   * Get work orders by order ID
   */
  async getByOrderId(orderId: string): Promise<WorkOrder[]> {
    const response = await axios.get<WorkOrderListResponse>(`${BASE_URL}/order/${orderId}`, {
      headers: getAuthHeader(),
    });
    return response.data.data || [];
  },

  /**
   * Create a new work order
   */
  async create(data: CreateWorkOrderDTO): Promise<WorkOrder> {
    const response = await axios.post<WorkOrderResponse>(BASE_URL, data, { headers: getAuthHeader() });
    if (!response.data.data) throw new Error('Failed to create work order');
    return response.data.data;
  },

  /**
   * Update a work order
   */
  async update(id: string, data: UpdateWorkOrderDTO): Promise<WorkOrder> {
    const response = await axios.put<WorkOrderResponse>(`${BASE_URL}/${id}`, data, { headers: getAuthHeader() });
    if (!response.data.data) throw new Error('Failed to update work order');
    return response.data.data;
  },

  /**
   * Delete a work order
   */
  async delete(id: string): Promise<void> {
    await axios.delete(`${BASE_URL}/${id}`, { headers: getAuthHeader() });
  },

  /**
   * Add production tracking update
   */
  async addProductionTracking(workOrderId: string, data: CreateProductionTrackingDTO): Promise<ProductionTracking> {
    const response = await axios.post<ProductionTrackingResponse>(`${BASE_URL}/${workOrderId}/tracking`, data, {
      headers: getAuthHeader(),
    });
    if (!response.data.data) throw new Error('Failed to add production tracking');
    return response.data.data;
  },

  /**
   * Approve a work order
   */
  async approve(id: string): Promise<WorkOrder> {
    const response = await axios.patch<WorkOrderResponse>(
      `${BASE_URL}/${id}/approve`,
      {},
      { headers: getAuthHeader() }
    );
    if (!response.data.data) throw new Error('Failed to approve work order');
    return response.data.data;
  },

  /**
   * Get production dashboard summary
   */
  async getDashboard(): Promise<ProductionDashboardSummary> {
    const response = await axios.get<ProductionDashboardResponse>(`${BASE_URL}/dashboard/summary`, {
      headers: getAuthHeader(),
    });
    if (!response.data.data) throw new Error('Failed to fetch dashboard');
    return response.data.data;
  },

  /**
   * Split a work order for partial dispatch
   * Creates a new work order with subset of quantities
   */
  async splitWorkOrder(id: string, data: SplitWorkOrderDTO): Promise<WorkOrder> {
    const response = await axios.post<WorkOrderResponse>(`${BASE_URL}/${id}/split`, data, { headers: getAuthHeader() });
    if (!response.data.data) throw new Error('Failed to split work order');
    return response.data.data;
  },

  /**
   * Check material readiness for a work order
   */
  async checkMaterialReadiness(id: string): Promise<{
    isReady: boolean;
    totalMaterials: number;
    availableMaterials: number;
    missingMaterials: Array<{
      materialName: string;
      materialCode: string;
      required: number;
      available: number;
      shortfall: number;
      unit: string;
    }>;
  }> {
    const response = await axios.get(`${BASE_URL}/${id}/material-readiness`, { headers: getAuthHeader() });
    if (!response.data.data) throw new Error('Failed to check material readiness');
    return response.data.data;
  },

  /**
   * Push work order to cutting stage
   */
  async pushToCutting(id: string, adminOverride?: boolean, overrideReason?: string): Promise<WorkOrder> {
    const response = await axios.post<WorkOrderResponse>(
      `${BASE_URL}/${id}/push-to-cutting`,
      { adminOverride, overrideReason },
      { headers: getAuthHeader() }
    );
    if (!response.data.data) throw new Error('Failed to push to cutting');
    return response.data.data;
  },

  async getFabricIssuanceData(id: string): Promise<FabricIssuanceData> {
    const response = await axios.get<{ success: boolean; data: FabricIssuanceData }>(
      `${BASE_URL}/${id}/fabric-issuance-data`,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  async issueFabric(id: string, data: IssueFabricRequest) {
    const response = await axios.post(`${BASE_URL}/${id}/issue-fabric`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  async getTrimIssuanceData(id: string): Promise<MaterialIssuanceData> {
    const response = await axios.get<{ success: boolean; data: MaterialIssuanceData }>(
      `${BASE_URL}/${id}/trim-issuance-data`,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  async issueTrims(id: string, data: IssueMaterialsRequest) {
    const response = await axios.post(`${BASE_URL}/${id}/issue-trims`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  async getPackagingIssuanceData(id: string): Promise<MaterialIssuanceData> {
    const response = await axios.get<{ success: boolean; data: MaterialIssuanceData }>(
      `${BASE_URL}/${id}/packaging-issuance-data`,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  async issuePackaging(id: string, data: IssueMaterialsRequest) {
    const response = await axios.post(`${BASE_URL}/${id}/issue-packaging`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  async getThreadIssuanceData(id: string): Promise<ThreadIssuanceData> {
    const response = await axios.get<{ success: boolean; data: ThreadIssuanceData }>(
      `${BASE_URL}/${id}/thread-issuance-data`,
      { headers: getAuthHeader() }
    );
    return response.data.data;
  },

  async issueThread(id: string, data: IssueThreadRequest) {
    const response = await axios.post(`${BASE_URL}/${id}/issue-thread`, data, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },

  async getWipSummary(id: string): Promise<WipSummary> {
    const response = await axios.get<{ success: boolean; data: WipSummary }>(`${BASE_URL}/${id}/wip-summary`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },
};

export default workOrderService;
