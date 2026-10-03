/**
 * External Process Types
 * Types for Smocking, Handwork, and Piece-Level Embroidery tracking
 */

export type ExternalProcessType = 'EMBROIDERY_PIECE' | 'SMOCKING' | 'HANDWORK';
export type ExternalProcessSourceType = 'CUTTING_BATCH' | 'FABRIC_STOCK' | 'STITCHING_ISSUE';
export type ExternalProcessStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface ExternalProcessSendOutSku {
  id: string;
  sendOutId: string;
  colorId?: string;
  sizeId: string;
  sentQty: number;
  receivedQty: number;
  damagedQty: number;
  goodQty: number;
  color?: { colorName: string };
  size?: { sizeName: string };
}

export interface ExternalProcessSendOut {
  id: string;
  batchNumber: string;
  processType: ExternalProcessType;
  sourceType: ExternalProcessSourceType;
  workOrderId: string;
  orderId?: string;
  styleId?: string;
  cuttingBatchId?: string;
  fabricStockId?: string;
  stitchingIssueId?: string;
  supplierId: string;
  quantitySent: number;
  quantityReceived?: number;
  quantityDamaged?: number;
  quantityGood?: number;
  unit: string;
  agreedRate: number;
  actualCost?: number;
  sendDate: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  // Phase 5b: the commercial doc is a Job Work Order; purchaseOrderId is legacy-only
  jobWorkOrderId?: string;
  purchaseOrderId?: string;
  serviceRequirementId?: string;
  outwardChallanId?: string;
  inwardChallanId?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  status: ExternalProcessStatus;
  remarks?: string;
  embroideryId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;

  // Nested relations (camelCase from serializer)
  workOrder?: { workOrderNumber: string; totalQuantity?: number };
  supplier?: { name: string; code?: string; phone?: string };
  purchaseOrder?: { poNumber: string; poCategory?: string; status?: string };
  jobWorkOrder?: { jobWorkNumber: string; jwoStatus?: string };
  order?: { orderNumber: string };
  style?: { styleCode: string; styleName: string; buyerStyleRef?: string | null };
  embroidery?: { designName: string; embroideryCode: string };
  serviceRequirement?: { serviceType: string; status: string; quantityRequired: number };
  skuBreakdown?: ExternalProcessSendOutSku[];
  createdBy?: { firstName: string; lastName: string };
  /** Fabric from stock: the lot it left, and the lot it came back as (its own lot — smocked is not plain fabric) */
  fabricStock?: { cutableWidth: number | string; fabricMaster?: { fabricCode: string } | null } | null;
  resultFabricStockId?: string | null;
  resultFabricStock?: { id: string; quantityAvailable: number | string; cutableWidth: number | string } | null;
}

export interface CreateExternalProcessSendOutRequest {
  /** FABRIC_STOCK: the user confirmed taking metres held for other orders (STOCK_HELD_FOR_ORDER) */
  takeHeld?: boolean;
  processType: ExternalProcessType;
  sourceType: ExternalProcessSourceType;
  workOrderId: string;
  orderId?: string;
  styleId?: string;
  cuttingBatchId?: string;
  fabricStockId?: string;
  stitchingIssueId?: string;
  supplierId: string;
  quantitySent: number;
  unit: string;
  agreedRate: number;
  sendDate: string;
  expectedReturnDate?: string;
  // Phase 5b: JWO replaces the service PO as the commercial document
  jobWorkOrderId: string;
  serviceRequirementId?: string;
  embroideryId?: string;
  remarks?: string;
  skus?: {
    colorId?: string;
    sizeId: string;
    sentQty: number;
  }[];
  /** Fabric Stock source: the rolls / thans that go (COUNTED metres) — the server takes the quantity from them */
  fabricDetails?: Array<{ fabricStockDetailId: string; metersToIssue: number }>;
}

export interface ExternalProcessReceiveRequest {
  sendOutId: string;
  /** Running totals: what has come back so far, and how much of it is damaged */
  quantityReceived: number;
  quantityDamaged?: number;
  /** Fabric from stock: its width after the process, inches — the width of the lot it comes back as */
  receivedWidth?: number;
  actualReturnDate: string;
  actualCost?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  remarks?: string;
  skus?: {
    sendOutSkuId: string;
    receivedQty: number;
    damagedQty: number;
  }[];
}

export interface ExternalProcessQueryParams {
  processType?: ExternalProcessType;
  status?: ExternalProcessStatus;
  supplierId?: string;
  workOrderId?: string;
  orderId?: string;
  styleId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface ExternalProcessDashboardVendor {
  supplierId: string;
  supplierName: string;
  sent: number;
  pending: number;
  received: number;
  overdue: number;
}

export interface ExternalProcessDashboardOrder {
  orderId: string;
  orderNumber: string;
  styleName: string;
  sent: number;
  qtySent: number;
  qtyReceived: number;
}

export interface ExternalProcessDashboard {
  summary: {
    totalSent: number;
    pending: number;
    partiallyReceived: number;
    received: number;
    overdue: number;
    totalQtySent: number;
    totalQtyReceived: number;
    totalQtyPending: number;
  };
  byVendor: ExternalProcessDashboardVendor[];
  byOrder: ExternalProcessDashboardOrder[];
}

export interface PaginatedExternalProcessSendOuts {
  data: ExternalProcessSendOut[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
