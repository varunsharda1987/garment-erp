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

/** One line of a multi-lot greige issue. */
export interface IssueLotInput {
  greigeStockLotId: string;
  qty: number;
}

/** A single than/bale detail within a greige lot (for bale/than-level issuance). */
export interface GreigeStockDetail {
  id: string;
  baleNumber: number | null;
  sequenceNo: number;
  meters: number;
  metersRemaining: number;
  status: 'AVAILABLE' | 'PARTIAL' | 'CONSUMED';
  remarks: string | null;
}

/** Detail-level selection for bale/than issuance. */
export interface IssueDetailInput {
  greigeStockDetailId: string;
  metersToIssue: number;
}

/** One lot with detail-level selections for issue-with-details. */
export interface IssueLotWithDetailsInput {
  greigeStockLotId: string;
  details: IssueDetailInput[];
}

/** Payload for bale/than-level issuance. */
export interface IssueWithDetailsPayload {
  sentDate?: string;
  vehicleNumber?: string;
  challanNumber?: string;
  lots: IssueLotWithDetailsInput[];
}

/**
 * Issue payload.
 *
 * A SINGLE lot must travel as `greigeStockLotId`, never as a one-element `lots` array: the
 * server then consumes the order's own `qtySentMeters` verbatim, so the issued quantity cannot
 * drift by a paisa from a number that went through an input box and back. `lots` exists for
 * genuine multi-lot issues, where only the operator knows the split — there the server checks
 * the quantities sum to the order quantity (within 0.01) before touching stock.
 */
export interface IssueJwoPayload {
  sentDate?: string;
  greigeStockLotId?: string;
  lots?: IssueLotInput[];
  fabricStockLotId?: string;
  vehicleNumber?: string;
  acknowledgeWidthMismatch?: boolean;
}

/** A greige lot the server considers issuable for this order — pre-filtered, sorted qty desc. */
export interface JwoIssuePreviewLot {
  id: string;
  greigeId: string;
  greigeCode: string | null;
  greigeName: string | null;
  greigeWidth: number | null;
  quantityAvailable: number;
  /** For lots at processor: the JWO this lot was originally issued for (for reallocation prompt) */
  originalJwo?: { id: string; jobWorkNumber: string } | null;
}

export interface JwoIssuePreview {
  canIssue: boolean;
  blockers: Array<{ code: string; message: string }>;
  /** The cloth this order's requirement chain calls for; null when the chain cannot name one. */
  expectedGreige: { id: string; greigeCode: string; greigeName: string } | null;
  /** false ⇒ availableLots spans several greiges, so the UI must hold the same-greige rule itself */
  greigeAnchored: boolean;
  requiredQty: number;
  uom: string;
  fabricType: string | null;
  /** Processor name for display (e.g., "Mangal Textile") */
  processorName: string | null;
  /** Lots already at the target processor (virtual issuance — no dispatch needed) */
  atProcessor: JwoIssuePreviewLot[];
  /** Total quantity available at processor */
  atProcessorTotal: number;
  /** Lots at main warehouse (require outward challan) */
  atMainWarehouse: JwoIssuePreviewLot[];
  /** Total quantity available at main warehouse */
  atMainWarehouseTotal: number;
  /** Legacy: combined list of all available lots (backwards compatibility) */
  availableLots: JwoIssuePreviewLot[];
}

/** One order waiting to go on a truck to a given processor, with the lots that could serve it. */
export interface DispatchableOrder {
  id: string;
  jobWorkNumber: string;
  processType: string;
  styleCode: string | null;
  requiredQty: number;
  uom: string;
  fabricType: string | null;
  expectedGreige: { id: string; greigeCode: string; greigeName: string } | null;
  /** false ⇒ availableLots spans several greiges, so the UI must hold the same-greige rule itself */
  greigeAnchored: boolean;
  /** NO_GREIGE_LOT is already filtered out server-side — picking lots here is what resolves it. */
  blockers: Array<{ code: string; message: string }>;
  availableLots: JwoIssuePreviewLot[];
}

/** One order's place on the truck. Same lot rule as a single issue: omit `lots` to use the stamp. */
export interface DispatchOrderInput {
  jwoId: string;
  lots?: IssueLotInput[];
  greigeStockLotId?: string | null;
  fabricStockLotId?: string | null;
}

export interface DispatchPayload {
  processorId: string;
  sentDate?: string;
  vehicleNumber?: string;
  challanNumber?: string;
  acknowledgeWidthMismatch?: boolean;
  orders: DispatchOrderInput[];
}

export interface DispatchResult {
  challanId: string;
  challanNumber: string;
  orders: Array<{ jwoId: string; jobWorkNumber: string }>;
  warnings: string[];
}

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
      /** Expected fabric due back (billable = sent × (1 − shrinkage)) */
      qtyBillable?: number | null;
      expectedShrinkage?: number | null;
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
    payload?: IssueJwoPayload
  ): Promise<{ data: JobWorkOrder; challanNumber: string; warning?: string }> {
    const response = await api.post(`${BASE_URL}/${id}/issue`, payload ?? {});
    return { data: response.data.data, challanNumber: response.data.challanNumber, warning: response.data.warning };
  },

  /**
   * Read-only dry run of the issue validation: every blocker at once (not just the first),
   * the greige the order is anchored to, and the lots that could serve it. Lots come back
   * already filtered (right cloth, AVAILABLE, not at a processor, not a transfer) and sorted
   * quantity-desc, which is what makes the dialog's greedy auto-fill correct.
   */
  async getIssuePreview(id: string): Promise<JwoIssuePreview> {
    const response = await api.get(`${BASE_URL}/${id}/issue-preview`);
    return response.data.data;
  },

  /**
   * Orders that could share one truck to this processor: approved, not yet sent, not cancelled —
   * each already carrying its expected cloth and the lots that could serve it, so the dispatch
   * screen fills in without a round trip per order.
   */
  async getDispatchable(processorId: string): Promise<DispatchableOrder[]> {
    const response = await api.get(`${BASE_URL}/dispatchable`, { params: { processorId } });
    return response.data.data;
  },

  /**
   * Send SEVERAL orders on ONE outward challan. All-or-nothing: the server runs the whole truck
   * in a single transaction, so a dispatch can never be half-recorded.
   */
  async dispatch(payload: DispatchPayload): Promise<{ data: DispatchResult; warning?: string }> {
    const response = await api.post(`${BASE_URL}/dispatch`, payload);
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
  /**
   * Withdraw a job work order before anything is received. Unlike delete (which exists only on the
   * legacy dyeing/printing routes), cancel works for EVERY process type, credits any issued
   * material back to stock, and reverts the requirements it covered to open so they can be
   * re-planned. Refused once goods have been received.
   */
  async cancel(id: string, reason?: string): Promise<{ data: JobWorkOrder; pendingDisposition?: boolean }> {
    const response = await api.post(`${BASE_URL}/${id}/cancel`, reason ? { reason } : {});
    return { data: response.data.data, pendingDisposition: response.data.pendingDisposition };
  },

  /**
   * Two-step cancel: after cancellation, user decides what happens to issued material.
   * Only available for CANCELLED JWOs with inventoryDisposition = 'PENDING'.
   */
  async disposeInventory(
    id: string,
    disposition: 'RETURNED_TO_STOCK' | 'AT_PROCESSOR' | 'WRITTEN_OFF' | 'TRANSFERRED' | 'RETURNED_TO_SUPPLIER',
    options?: { notes?: string; targetJwoId?: string }
  ): Promise<JobWorkOrder> {
    const response = await api.post(`${BASE_URL}/${id}/dispose-inventory`, {
      disposition,
      ...options,
    });
    return response.data.data;
  },

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

  /**
   * Get available bale/than details for a greige stock lot (for bale/than-level issuance).
   * Returns the individual thans grouped by bale, with remaining meters.
   */
  async getAvailableDetails(greigeStockId: string): Promise<GreigeStockDetail[]> {
    const response = await api.get(`/greige/stock/${greigeStockId}/available-details`);
    return response.data.data;
  },

  /**
   * Issue with bale/than-level detail selection (for processor dispatch).
   * Allows selecting specific thans and optionally splitting them.
   */
  async issueWithDetails(
    id: string,
    payload: IssueWithDetailsPayload
  ): Promise<{ data: JobWorkOrder; challanNumber: string; warning?: string }> {
    const response = await api.post(`${BASE_URL}/${id}/issue-with-details`, payload);
    return { data: response.data.data, challanNumber: response.data.challanNumber, warning: response.data.warning };
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
  jwoStatus: string;
  tolerancePercent: number | null;
  source: 'COMPONENTS' | 'ORDER_CHALLANS' | 'ORDER_SNAPSHOT';
  components: JwoReconciliationComponent[];
  totals: { outward: number; inward: number; balanceWithVendor: number };
}

export default jobWorkOrderService;
