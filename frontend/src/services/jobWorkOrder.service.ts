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
  CreateJobWorkOrderRequest,
} from '@/types/jobWorkOrder.types';

const BASE_URL = '/job-work-orders';

export const jobWorkOrderService = {
  /**
   * Create a DRAFT job work order (Consolidation Phase 3).
   * Returns the created JWO plus an optional warning (e.g. unresolved GST rate).
   */
  async create(data: CreateJobWorkOrderRequest): Promise<{ data: JobWorkOrder; warning?: string }> {
    const response = await api.post(BASE_URL, data);
    return { data: response.data.data, warning: response.data.warning };
  },

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
   * Phase 4b: PO-less JWOs receivable via GRN (sent to processor, nothing back yet)
   */
  async getReceivable(): Promise<
    Array<{
      id: string;
      jobWorkNumber: string;
      processType: string;
      qtySentMeters: number;
      uom: string;
      sentDate?: string;
      expectedReturnDate?: string;
      processor?: { id: string; name: string };
      style?: { id: string; styleCode: string };
      fabric?: { id: string; fabricCode: string; fabricName: string };
    }>
  > {
    const response = await api.get(`${BASE_URL}/receivable`);
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
   * Issue material to processor (Phase 4c: operational — consumes the greige lot,
   * creates the OUTWARD challan, locks the statutory due date)
   */
  async issue(
    id: string,
    payload?: { sentDate?: string; greigeStockLotId?: string; challanNumber?: string; vehicleNumber?: string }
  ): Promise<{ data: JobWorkOrder; warning?: string }> {
    const response = await api.post(`${BASE_URL}/${id}/issue`, payload ?? {});
    return { data: response.data.data, warning: response.data.warning };
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

  /**
   * Computed reconciliation (Phase 3b) — challan-line balances per component (D5)
   */
  async getReconciliation(id: string): Promise<JwoReconciliation> {
    const response = await api.get(`${BASE_URL}/${id}/reconciliation`);
    return response.data.data;
  },

  /**
   * Close a received JWO (Phase 3b) — requires invoice number; abnormal loss needs a debit note
   */
  async close(id: string, invoiceNumber?: string, remarks?: string): Promise<{ data: JobWorkOrder; warning?: string }> {
    const response = await api.post(`${BASE_URL}/${id}/close`, { invoiceNumber, remarks });
    return { data: response.data.data, warning: response.data.warning };
  },
};

export interface JwoReconciliationComponent {
  id: string | null;
  materialType: string;
  name: string;
  unit: string;
  qtySent: number;
  outward: number;
  inward: number;
  balanceWithVendor: number;
  qtyReceived: number | null;
  qtyNormalLoss: number | null;
  qtyAbnormalLoss: number | null;
  isChargeable: boolean;
  isReturnable: boolean;
}

export interface JwoReconciliation {
  jobWorkNumber: string;
  status: string;
  jwoStatus?: string;
  tolerancePercent: number | null;
  source: 'COMPONENTS' | 'ORDER_CHALLANS' | 'ORDER_SNAPSHOT';
  components: JwoReconciliationComponent[];
  totals: { outward: number; inward: number; balanceWithVendor: number };
}

export default jobWorkOrderService;
