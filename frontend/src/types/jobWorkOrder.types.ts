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

export type LegacyJobWorkStatus =
  | 'LAB_DIP_PENDING'
  | 'LAB_DIP_SUBMITTED'
  | 'LAB_DIP_APPROVED'
  | 'READY_TO_SEND'
  | 'SENT_TO_MILL'
  | 'AT_MILL'
  | 'RECEIVED'
  | 'QUALITY_CHECKED'
  | 'STOCK_UPDATED';

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
  fabricType?: string;
  reprocessReason?: string;
  qtySentMeters: number;
  sentWidthInches?: number;
  uom: string;
  sentDate?: string;
  challanNumber?: string;
  vehicleNumber?: string;
  expectedReturnDate?: string;
  expectedShrinkage?: number;
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
  status: LegacyJobWorkStatus;
  jwoStatus?: JobWorkOrderStatus;
  remarks?: string;
  workOrderId?: string;
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

  // Relations
  processor?: { id: string; name: string; code: string };
  style?: { id: string; styleCode: string; buyerStyleRef?: string };
  fabric?: { id: string; fabricCode: string; fabricName: string };
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
}

export interface JobWorkOrderQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: LegacyJobWorkStatus;
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
