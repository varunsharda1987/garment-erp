/**
 * Job Work Order Service
 * Frontend API service for unified JWO operations
 */

import api from '@/lib/api';
import type {
  JobWorkOrder,
  JobWorkOrderQueryParams,
  JobWorkOrderDashboard,
  PaginatedJobWorkOrders,
  LossSplitResult,
} from '@/types/jobWorkOrder.types';

const BASE_URL = '/job-work-orders';

export const jobWorkOrderService = {
  /**
   * Get paginated list of job work orders
   */
  async getAll(params?: JobWorkOrderQueryParams): Promise<PaginatedJobWorkOrders> {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  /**
   * Get single job work order by ID
   */
  async getById(id: string): Promise<JobWorkOrder> {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data.data;
  },

  /**
   * Get dashboard summary
   */
  async getDashboard(): Promise<JobWorkOrderDashboard> {
    const response = await api.get(`${BASE_URL}/dashboard`);
    return response.data.data;
  },

  /**
   * Get JWOs with abnormal loss (over tolerance)
   */
  async getOverTolerance(): Promise<JobWorkOrder[]> {
    const response = await api.get(`${BASE_URL}/over-tolerance`);
    return response.data.data;
  },

  /**
   * Compute commercial totals (GST, subtotal, total)
   * @throws Error with code GST_RATE_UNRESOLVED if rate is NULL
   */
  async computeTotals(id: string): Promise<JobWorkOrder> {
    const response = await api.post(`${BASE_URL}/${id}/compute-totals`);
    return response.data.data;
  },

  /**
   * Issue material to processor
   * Sets statutory due date and computes GST
   */
  async issue(id: string, sentDate?: string): Promise<JobWorkOrder> {
    const response = await api.post(`${BASE_URL}/${id}/issue`, { sentDate });
    return response.data.data;
  },

  /**
   * Receive material back from processor with loss split
   */
  async receive(
    id: string,
    qtyReceived: number,
    receivedDate?: string
  ): Promise<{ data: JobWorkOrder; lossSplit: LossSplitResult }> {
    const response = await api.post(`${BASE_URL}/${id}/receive`, {
      qtyReceived,
      receivedDate,
    });
    return response.data;
  },

  /**
   * Approve a job work order
   */
  async approve(id: string): Promise<JobWorkOrder> {
    const response = await api.post(`${BASE_URL}/${id}/approve`);
    return response.data.data;
  },
};

export default jobWorkOrderService;
