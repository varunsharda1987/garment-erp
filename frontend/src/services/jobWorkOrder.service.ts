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

/** One source lot on an issue: a greige lot on a cloth job, a lace lot on a lace job. */
export interface IssueLotInput {
  greigeStockLotId?: string;
  laceStockLotId?: string;
  qty: number;
}

/**
 * One than (a folded piece) of a greige lot, grouped in bales. `meters` / `metersRemaining` are
 * COUNTED (tag) metres at the lot's fold length — never compare them to a lot or job quantity,
 * which are ACTUAL metres (see @/lib/fold-length).
 */
export interface GreigeStockDetail {
  id: string;
  /** Internal bale grouping (1, 2, 3…); null for a than received outside any bale */
  baleNumber: number | null;
  sequenceNo: number;
  /** COUNTED metres the than arrived with */
  meters: number;
  /** COUNTED metres still in the godown */
  metersRemaining: number;
  status: 'AVAILABLE' | 'PARTIAL' | 'CONSUMED';
  /** Bale number printed on the bale, when it was entered at receipt */
  baleNo: string | null;
  /** Than tag number, when it was entered at receipt */
  thanNo: string | null;
  remarks: string | null;
}

/** GET /api/greige/stock/:stockId/available-details — the lot's thans still in the godown. */
export interface GreigeLotThans {
  stockId: string;
  baleCount: number | null;
  thanCount: number | null;
  /** ACTUAL metres available in the lot */
  totalAvailable: number;
  /** The lot's fold length L in cm — than metres are counted at it; null = no fold */
  foldLengthCm: number | null;
  details: GreigeStockDetail[];
}

/** One picked than: which than, and how many COUNTED metres of it (a partial than is allowed). */
export interface IssueDetailInput {
  greigeStockDetailId: string;
  metersToIssue: number;
}

/**
 * One lot on issue-with-details: either the thans that leave (`details`, COUNTED metres — the
 * server converts them to actual itself) or a plain quantity (`qty`, ACTUAL metres). Mixed lots
 * in one issue are allowed.
 */
export interface IssueLotWithDetailsInput {
  greigeStockLotId: string;
  details?: IssueDetailInput[];
  qty?: number;
}

/** POST /api/job-work-orders/:id/issue-with-details */
export interface IssueWithDetailsPayload {
  sentDate?: string;
  vehicleNumber?: string;
  challanNumber?: string;
  acknowledgeWidthMismatch?: boolean;
  finishedFabricId?: string | null;
  lots: IssueLotWithDetailsInput[];
}

/** GET /api/job-work-orders/:id/than-record — one greige lot the job took. */
export interface ThanRecordLot {
  greigeStockLotId: string;
  greigeCode: string | null;
  foldLengthCm: number | null;
  /** ACTUAL metres the job took from this lot */
  takenActual: number;
  /** Thans already named against the job, COUNTED and ACTUAL */
  recordedCounted: number;
  recordedActual: number;
  /** false = the lot was received without a than breakdown, so there is nothing to name */
  lotHasThans: boolean;
}

export interface ThanRecord {
  jobWorkNumber: string;
  jwoStatus: string;
  lots: ThanRecordLot[];
}

/** POST /api/job-work-orders/:id/record-thans */
export interface RecordThansPayload {
  lots: Array<{ greigeStockLotId: string; details: IssueDetailInput[] }>;
}

/** POST /api/grn/jwo/receive — the one-action job-work receipt. */
export interface ReceiveToStockPayload {
  jobWorkOrderId: string;
  qtyReceivedMeters?: number;
  thanCount?: number;
  foldLengthCm?: number;
  receivedWidthInches?: number;
  receivedChallan?: string;
  /** The day the goods came back — becomes the receipt date, the job's receivedDate and the inward challan date. */
  receivedDate: string;
  warehouseId: string;
  /**
   * false = one delivery of several — the job goes Partially Received and stays receivable.
   * true (default on the server) = the last delivery — the job closes on the cumulative total.
   */
  isFinal?: boolean;
  /**
   * Required (true) when the final delivery leaves the total short beyond the tolerance — the server
   * refuses a short close that was not confirmed (details.reason SHORT_CLOSE_UNCONFIRMED).
   */
  shortCloseConfirmed?: boolean;
  entryMode?: 'TOTAL_METERS' | 'THAN_WISE' | 'BALE_WISE';
  /** Than-/bale-wise rows; the server sums them for the quantity and counts them for thanCount. */
  details?: Array<{ detailType: 'THAN'; baleNumber: number | null; sequenceNo: number; meters: number }>;
  processingQC?: { qualityGrade?: 'A' | 'B' | 'Reject'; defectMeters?: number };
}

/** GET /api/job-work-orders/:id/receive-preview — the server's own loss split for a hypothetical quantity. */
export interface JwoReceivePreview {
  qtyExpected: number;
  tolerancePercent: number;
  allowedLoss: number;
  shortfall: number;
  qtyNormalLoss: number;
  qtyAbnormalLoss: number;
  isOverTolerance: boolean;
  debitNoteRequired: boolean;
  debitNoteAmount: number | null;
  maxReceivable: number;
}

/**
 * Issue payload.
 *
 * A SINGLE lot must travel as `greigeStockLotId`, never as a one-element `lots` array: the
 * server then consumes the order's own `qtySentMeters` verbatim, so the issued quantity cannot
 * drift by a paisa from a number that went through an input box and back. `lots` exists for
 * genuine multi-lot issues, where only the operator knows the split — there the server checks
 * the quantities sum to the order quantity (within 0.01) before touching stock.
 *
 * A LACE job is the exception: it has no header lot pointer to consume verbatim, so even a
 * single lace lot travels as a one-element `lots` array.
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
/** A dispatch lot row: an issue lot that may also name the thans that leave (COUNTED metres). */
export interface DispatchLotInput extends IssueLotInput {
  /** qty must then be the picks' ACTUAL metres — the server recomputes it from the thans */
  details?: IssueDetailInput[];
}

export interface DispatchOrderInput {
  jwoId: string;
  lots?: DispatchLotInput[];
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
   * Receive processed material back from the processor in ONE action: the receipt is filed
   * (already accepted) and the stock lot, inward challan, loss split and MRP advance are booked
   * in the same transaction. The route lives under /grn because that is the permission store
   * staff hold — the URL is invisible to the user.
   */
  async receiveToStock(
    payload: ReceiveToStockPayload
  ): Promise<{ data: { id: string; grnNumber: string }; lossSplit: LossSplitResult }> {
    const response = await api.post('/grn/jwo/receive', payload);
    return response.data;
  },

  /**
   * Read-only: what a receipt of `qty` would mean — shortfall, abnormal loss, debit note, and
   * the most the job can accept. Drives the warning in the receive dialog before commit.
   */
  async getReceivePreview(id: string, qty: number): Promise<JwoReceivePreview> {
    const response = await api.get(`${BASE_URL}/${id}/receive-preview`, { params: { qty } });
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
   * Nothing more is coming after a part: finalise a Partial Receipt job on what has been received.
   * The shortfall becomes a loss against the processor; no further receipt is filed.
   */
  async closeShort(
    id: string,
    payload: { shortCloseConfirmed: boolean; remarks?: string }
  ): Promise<{ data: JobWorkOrder; lossSplit: LossSplitResult }> {
    const response = await api.post(`${BASE_URL}/${id}/close-short`, payload);
    return response.data;
  },

  /**
   * The processor sent it back untouched: credits the lot, files the inward challan and closes
   * the job, in one transaction. Same writer the Dyeing and Printing pages use.
   */
  async returnUnprocessed(
    id: string,
    payload: { returnedQty: number; returnDate?: string; remarks?: string }
  ): Promise<{
    jobWorkOrderId: string;
    jobWorkNumber: string;
    returnedQty: number;
    creditedTo: 'GREIGE' | 'LACE' | 'FABRIC' | 'NONE';
    inwardChallanId: string;
    inwardChallanNumber: string;
  }> {
    const response = await api.post(`${BASE_URL}/${id}/return-unprocessed`, payload);
    return response.data.data;
  },

  /**
   * The thans of a greige lot still in the godown, grouped by bale, with the lot's fold length.
   * Than metres are COUNTED; `totalAvailable` is ACTUAL.
   */
  async getAvailableDetails(greigeStockId: string): Promise<GreigeLotThans> {
    const response = await api.get(`/greige/stock/${greigeStockId}/available-details`);
    return response.data.data;
  },

  /**
   * Issue naming the thans that leave. Each lot carries either picked thans (COUNTED metres) or a
   * plain ACTUAL quantity; the server converts picks to actual itself.
   */
  async issueWithDetails(
    id: string,
    payload: IssueWithDetailsPayload
  ): Promise<{ data: JobWorkOrder; challanNumber: string; warning?: string }> {
    const response = await api.post(`${BASE_URL}/${id}/issue-with-details`, payload);
    return { data: response.data.data, challanNumber: response.data.challanNumber, warning: response.data.warning };
  },

  /** The greige lots an issued job took, and how much of each is already named by than. */
  async getThanRecord(id: string): Promise<ThanRecord> {
    const response = await api.get(`${BASE_URL}/${id}/than-record`);
    return response.data.data;
  },

  /**
   * Name the thans that left on a job issued by quantity. Marks them issued; the lot's stock is
   * not moved again. Refused (422) when the picks exceed what the job took from the lot.
   */
  async recordThans(
    id: string,
    payload: RecordThansPayload
  ): Promise<{ jobWorkNumber: string; lots: ThanRecordLot[] }> {
    const response = await api.post(`${BASE_URL}/${id}/record-thans`, payload);
    return response.data.data;
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
