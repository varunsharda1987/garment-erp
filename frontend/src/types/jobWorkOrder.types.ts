/**
 * Job Work Order Types
 * Frontend types for the unified JWO module
 */

export type JobWorkOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ISSUED'
  | 'IN_TRANSIT'
  | 'AT_PROCESSOR'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'QUALITY_CHECKED'
  | 'STOCK_UPDATED'
  | 'CLOSED'
  | 'CANCELLED';

/** Tracks what happened to issued material after JWO cancellation */
export type InventoryDisposition =
  | 'PENDING'
  | 'RETURNED_TO_STOCK'
  | 'AT_PROCESSOR'
  | 'WRITTEN_OFF'
  | 'TRANSFERRED'
  | 'RETURNED_TO_SUPPLIER';

export interface JobWorkOrderComponent {
  id: string;
  jobWorkOrderId: string;
  materialType: string;
  greigeId?: string;
  fabricId?: string;
  laceId?: string;
  materialId?: number;
  greigeStockId?: string;
  fabricStockId?: string;
  laceStockId?: string;
  threadStockId?: string;
  qtySent: number;
  qtyReceived?: number;
  qtyNormalLoss?: number;
  qtyAbnormalLoss?: number;
  unit: string;
  rate?: number;
  rateAtIssue?: number;
  declaredValue?: number;
  isChargeable: boolean;
  isReturnable: boolean;
  hsnCode?: string;
  description?: string;
  colorName?: string;
  componentName?: string;
  sortOrder: number;
  greige?: { id: string; greigeCode: string; greigeName: string };
  fabric?: { id: string; fabricCode: string; fabricName: string };
  lace?: { id: string; laceCode: string; laceName: string };
}

export interface JobWorkOrder {
  id: string;
  jobWorkNumber: string;
  processType: string;
  processTypeId?: string;
  labDipId?: string;
  styleId?: string;
  fabricId?: string;
  processorId: string;
  fabricStockLotId?: string;
  /** 'GREIGE' | 'FINISHED' | 'LACE' — the material the job handles, not the process category. */
  fabricType?: string;
  /** Lace dyeing: the greige lace sent and the dyed variant expected back. */
  greigeLaceId?: string | null;
  finishedLaceId?: string | null;
  reprocessReason?: string;
  qtySentMeters: number;
  /** Greige (loom-state) width of the material issued, e.g. 63". */
  greigeWidthInches?: number | null;
  /** ASKED FINISHED width (stenter target the processor must deliver) = cutable + selvedge deduction. */
  sentWidthInches?: number;
  uom: string;
  sentDate?: string;
  challanNumber?: string;
  vehicleNumber?: string;
  expectedReturnDate?: string;
  expectedShrinkage?: number;
  /** Billing qty = expected fabric-out (sent × (1 − shrinkage)). Null = bills on qtySentMeters. */
  qtyBillable?: number | null;
  agreedRatePerMeter: number;
  isRateTbd: boolean;
  qtyReceivedMeters?: number;
  receivedWidthInches?: number;
  receivedDate?: string;
  receivedChallan?: string;
  invoiceNumber?: string;
  actualShrinkage?: number;
  widthVariance?: number;
  qualityGrade?: string;
  colorMatchStatus?: string;
  defectMeters?: number;
  defectType?: string;
  actualRate?: number;
  jwoStatus: JobWorkOrderStatus;
  remarks?: string;
  workOrderId?: string;
  outwardChallanId?: string;
  inwardChallanId?: string;
  /** The receipt filed when the material came back (badged "Job work return" on the GRN list). */
  grnId?: string | null;
  thanCount?: number | null;
  foldLengthCm?: number | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;

  // Commercial fields (Phase 2)
  subtotal?: number;
  gstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalTaxAmount?: number;
  totalAmount?: number;
  isInterstate: boolean;
  isReverseCharge: boolean;
  paymentTerms?: string;
  paymentDueDays?: number;
  approvedById?: string;
  approvedAt?: string;
  statutoryDueDate?: string;
  ewayBillNumber?: string;
  ewayBillDate?: string;
  declaredValue?: number;

  // Tolerance/loss (Phase 6)
  tolerancePercent?: number;
  qtyNormalLoss?: number;
  qtyAbnormalLoss?: number;

  // Inventory disposition (two-step cancel flow)
  inventoryDisposition?: InventoryDisposition | null;
  inventoryDispositionDate?: string | null;
  inventoryDispositionById?: string | null;
  inventoryDispositionBy?: { id: string; firstName: string; lastName: string } | null;
  inventoryDispositionNotes?: string | null;
  inventoryTransferredToId?: string | null;
  inventoryTransferredTo?: { id: string; jobWorkNumber: string } | null;

  // Relations
  processor?: { id: string; name: string; code: string; phone?: string | null; contactPerson?: string | null };
  /** Issued greige lot (post-issue) — carries the greige master identity. */
  greigeStockLot?: { id: string; greige?: { id: string; greigeCode: string; greigeName: string } | null } | null;
  /** Pre-issue MRP chain — greige identity + colour before any lot exists. */
  requirementLinks?: Array<{
    materialRequirements?: {
      colorName?: string | null;
      materials?: { name: string; code: string } | null;
      orderBomItem?: { greige?: { id: string; greigeCode: string; greigeName: string } | null } | null;
    } | null;
  }>;
  style?: { id: string; styleCode: string; buyerStyleRef?: string };
  /** Shade asked on a stock (style-less) job. Order-linked jobs read colour off the chain above. */
  colorMaster?: { id: string; colorCode: string; colorName: string; hexCode?: string | null } | null;
  colorName?: string | null;
  colorMasterId?: string | null;
  fabric?: { id: string; fabricCode: string; fabricName: string };
  greigeLace?: {
    id: string;
    laceCode: string;
    laceName: string;
    expectedShrinkagePercent?: number | null;
  } | null;
  finishedLace?: { id: string; laceCode: string; laceName: string; color?: string | null } | null;
  processTypeMaster?: {
    id: string;
    code: string;
    name: string;
    sacCode: string;
    gstRate?: number;
    tolerancePercent: number;
  };
  components?: JobWorkOrderComponent[];
  createdBy?: { id: string; username: string };
  approvedBy?: { id: string; username: string };
  grn?: { id: string; grnNumber: string } | null;
}

export interface JobWorkOrderQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  jwoStatus?: JobWorkOrderStatus;
  processType?: string;
  processorId?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * POST /api/job-work-orders (Consolidation Phase 3)
 * Quantity is in the process type's unit of measure (MTR fabric / PCS garment / TRIP transport).
 * KAAJ_BUTTON: buttonholeCount/buttonCount drive the total; rates default from system settings.
 */
export interface CreateJobWorkOrderRequest {
  processType: string;
  processorId: string;
  styleId?: string | null;
  fabricId?: string | null;
  quantity: number;
  uom?: 'MTR' | 'PCS' | 'KG' | 'TRIP';
  agreedRate?: number;
  isRateTbd?: boolean;
  expectedReturnDate?: string | null;
  remarks?: string;
  buttonholeCount?: number;
  buttonCount?: number;
  buttonholeRatePerUnit?: number;
  buttonRatePerUnit?: number;
  // Phase 5b: fabric-roll embroidery source lot + design
  fabricStockLotId?: string | null;
  embroideryId?: string | null;
  // Stock (style-less) fabric jobs — what an order-linked job reads off its requirement chain.
  // Server rejects these on a non-fabric process type.
  colorMasterId?: string | null;
  colorName?: string | null;
  /** ASKED FINISHED width the processor must hold on the stenter. */
  sentWidthInches?: number | null;
  /** Rate-card shrinkage; the server derives qtyBillable (expected fabric back) from it. */
  expectedShrinkage?: number | null;
  /**
   * Lace dyeing (DYEING only, and never with a fabric): the greige lace sent and the dyed
   * variant expected back. Supplied together or not at all. When expectedShrinkage is omitted
   * the server falls back to the greige lace master's own expected loss.
   */
  greigeLaceId?: string | null;
  finishedLaceId?: string | null;
}

export interface JobWorkOrderDashboard {
  byStatus: Record<string, number>;
  byProcessType: Record<string, number>;
  outstanding: number;
  section143Warnings: number;
  overTolerance: number;
}

export interface LossSplitResult {
  qtyNormalLoss: number;
  qtyAbnormalLoss: number;
  tolerancePercent: number;
  actualShrinkage: number;
}

export interface PaginatedJobWorkOrders {
  data: JobWorkOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
