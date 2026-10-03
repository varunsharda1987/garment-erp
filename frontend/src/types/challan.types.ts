// ============================================
// CHALLAN TYPES - Material Movement Documents
// ============================================

export const ChallanType = {
  OUTWARD: 'OUTWARD',
  INWARD: 'INWARD',
  INTERNAL: 'INTERNAL',
} as const;

export type ChallanType = (typeof ChallanType)[keyof typeof ChallanType];

export const ChallanTypeLabels: Record<ChallanType, string> = {
  OUTWARD: 'Outward',
  INWARD: 'Inward',
  INTERNAL: 'Internal',
};

export const ChallanTypeColors: Record<ChallanType, string> = {
  OUTWARD: 'bg-orange-100 text-orange-800',
  INWARD: 'bg-success-muted text-success',
  INTERNAL: 'bg-info-muted text-info',
};

export const ChallanStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type ChallanStatus = (typeof ChallanStatus)[keyof typeof ChallanStatus];

export const ChallanStatusLabels: Record<ChallanStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  IN_TRANSIT: 'In Transit',
  RECEIVED: 'Received',
  PARTIALLY_RECEIVED: 'Partially Received',
  CANCELLED: 'Cancelled',
};

export const ChallanStatusColors: Record<ChallanStatus, string> = {
  DRAFT: 'bg-muted text-foreground',
  ISSUED: 'bg-info-muted text-info',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-success-muted text-success',
  PARTIALLY_RECEIVED: 'bg-warning/10 text-warning',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

// ============================================
// INTERFACES
// ============================================

export interface ChallanItem {
  id: string;
  challanId: string;
  itemType: string;
  materialId?: string;
  fabricId?: string;
  description: string;
  quantity: number;
  receivedQty?: number;
  damagedQty?: number;
  unit: string;
  colorId?: string;
  sizeId?: string;
  rate?: number;
  remarks?: string;
  /** Goods-in-transit challan: the PO line, how the supplier's paper lists it, and what actually arrived */
  poItemId?: string | null;
  entryMode?: TransitEntryMode | null;
  arrivedQty?: number | null;
}

/**
 * A goods-in-transit challan's state (2026-09-29): OPEN = on the way, CLAIMED = a receipt against it waits for
 * QC, ADOPTED = the receipt was approved (the goods are with the processor), CANCELLED = the truck never came.
 */
export type TransitState = 'OPEN' | 'CLAIMED' | 'ADOPTED' | 'CANCELLED';

export type TransitEntryMode = 'TOTAL_METERS' | 'THAN_WISE' | 'BALE_WISE' | 'ROLL_WISE';

export interface TransitPiece {
  detailType: 'THAN' | 'ROLL';
  baleNumber: number | null;
  baleNo: string | null;
  thanNo: string | null;
  sequenceNo: number;
  /** COUNTED tag metres */
  meters: number;
}

/** GET /challans/goods-in-transit?poId= — one of a PO's transit challans, with its lines and pieces */
export interface TransitChallan {
  id: string;
  challanNumber: string;
  challanDate: string;
  status: ChallanStatus;
  transitState: TransitState;
  /** The place the goods are headed (the delivery point's, else the PO's one place) */
  warehouseId: string | null;
  supplierDispatchedAt: string;
  supplierInvoiceNumber: string | null;
  supplierInvoiceDate: string | null;
  vehicleNumber: string | null;
  lrNumber: string | null;
  ewayBillNumber: string | null;
  ewayBillDate: string | null;
  toId: string | null;
  toName: string;
  poDeliveryPointId: string | null;
  directSupplyGrnId: string | null;
  directSupplyGrn: { id: string; grnNumber: string; receivingDate: string; status: string } | null;
  items: Array<{
    id: string;
    poItemId: string | null;
    description: string;
    /** ACTUAL — what was despatched */
    quantity: number;
    unit: string;
    foldLengthCm: number | null;
    entryMode: TransitEntryMode | null;
    arrivedQty: number | null;
    pieces: TransitPiece[];
  }>;
}

/** POST /challans/goods-in-transit — quantities COUNTED, as on the supplier's paper */
export interface CreateTransitChallanRequest {
  poId: string;
  poDeliveryPointId?: string | null;
  challanDate?: string;
  dispatchedOn: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  vehicleNumber?: string | null;
  lrNumber?: string | null;
  ewayBillNumber?: string | null;
  ewayBillDate?: string | null;
  remarks?: string | null;
  lines: Array<{
    poItemId: string;
    quantity: number;
    foldLengthCm?: number | null;
    entryMode?: TransitEntryMode | null;
    pieces?: Array<
      Omit<TransitPiece, 'baleNumber' | 'baleNo' | 'thanNo'> & {
        baleNumber?: number | null;
        baleNo?: string | null;
        thanNo?: string | null;
      }
    >;
  }>;
}

export interface Challan {
  id: string;
  challanNumber: string;
  challanType: ChallanType;
  challanDate: string;
  orderId?: string;
  productionRunId?: string;
  purchaseOrderId?: string;
  fromType: string;
  fromId?: string;
  fromName: string;
  toType: string;
  toId?: string;
  toName: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  lrNumber?: string;
  status: ChallanStatus;
  issuedDate?: string;
  expectedDate?: string;
  receivedDate?: string;
  totalItems: number;
  totalQuantity: number;
  receivedQuantity?: number;
  unit: string;
  remarks?: string;
  issuedById: string;
  receivedById?: string;
  createdAt: string;
  updatedAt: string;
  // Relations (camelCase from serializer)
  order?: {
    id: string;
    orderNumber: string;
    totalQuantity?: number;
    customer?: { id: string; name: string };
  };
  productionRun?: {
    id: string;
    workOrderNumber: string;
    totalQuantity?: number;
    style?: { id: string; styleCode: string; styleName: string; buyerStyleRef?: string | null };
  };
  purchaseOrder?: { id: string; poNumber: string; suppliers?: { id: string; name: string } };
  issuedBy?: { id: string; firstName: string; lastName: string };
  receivedBy?: { id: string; firstName: string; lastName: string };
  items: ChallanItem[];
  /** The thans / bales / rolls on this challan — the same list the printed challan carries. Null when none are recorded. */
  packingList?: ChallanPackingList | null;
  /** Goods-in-transit challan (issued when the supplier despatched straight to a processor); null otherwise */
  transitState?: TransitState | null;
  poDeliveryPointId?: string | null;
  /** A challan for goods a supplier delivered straight to the processor: the receipt it belongs to */
  directSupplyGrnId?: string | null;
  supplierDispatchedAt?: string | null;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceDate?: string | null;
  ewayBillNumber?: string | null;
  ewayBillDate?: string | null;
  /** The receipt a direct-supply challan belongs to — for a transit challan, the one that recorded the arrival */
  directSupplyGrn?: { id: string; grnNumber: string; receivingDate: string; status: string } | null;
  /** The job work order(s) this challan belongs to — an outward one is received on the job, never by hand here */
  jobWorkOrder?: { id: string; jobWorkNumber: string } | null;
  jobWorkOutward?: Array<{ id: string; jobWorkNumber: string }>;
}

/** Built by buildChallanPackingList (backend document-data/challan.doc-data.ts). Metres are the TAG (counted) figures. */
export interface ChallanPackingList {
  thanList: Array<{ bale: string; baleNote: string; thans: string; count: number; metres: string }>;
  thanListTotal: { count: number; metres: string; actualNote: string | null };
  thanListLabels: { group: string; pieceNo: string; count: string; total: string };
}

// ============================================
// INPUT TYPES
// ============================================

export interface CreateChallanItemInput {
  itemType: string;
  materialId?: string;
  fabricId?: string;
  greigeStockId?: string;
  fabricStockId?: string;
  laceStockId?: string;
  threadStockId?: string;
  description: string;
  quantity: number;
  unit?: string;
  colorId?: string;
  sizeId?: string;
  rate?: number;
  remarks?: string;
  foldLengthCm?: number;
  thanCount?: number;
}

export interface CreateChallanInput {
  challanType: ChallanType;
  challanDate?: string;
  orderId?: string;
  productionRunId?: string;
  purchaseOrderId?: string;
  fromType: string;
  fromId?: string;
  fromName: string;
  toType: string;
  toId?: string;
  toName: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  lrNumber?: string;
  expectedDate?: string;
  unit?: string;
  remarks?: string;
  items: CreateChallanItemInput[];
}

export interface ReceiveChallanInput {
  receivedDate?: string;
  items: {
    challanItemId: string;
    receivedQty: number;
    damagedQty?: number;
    remarks?: string;
  }[];
  remarks?: string;
}

export interface ChallanFilters {
  challanType?: ChallanType;
  status?: ChallanStatus;
  orderId?: string;
  productionRunId?: string;
  purchaseOrderId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  // New filters for greige dept register
  itemType?: string;
  processorId?: string;
  todayOnly?: boolean;
}

export interface TodaySummaryProcessor {
  processorId: string;
  processorName: string;
  challanCount: number;
  totalQuantity: number;
  totalValue: number;
  itemTypes: string[];
}

export interface TodaySummary {
  date: string;
  totalChallans: number;
  totalQuantity: number;
  byProcessor: TodaySummaryProcessor[];
}

export interface ChallanStats {
  total: number;
  byType: { type: ChallanType; count: number }[];
  byStatus: { status: ChallanStatus; count: number }[];
}

// Item type options for challan items
export const CHALLAN_ITEM_TYPES = [
  { value: 'FABRIC', label: 'Fabric' },
  { value: 'GREIGE', label: 'Greige Fabric' },
  { value: 'LACE', label: 'Lace' },
  { value: 'TRIM', label: 'Trim / Accessory' },
  { value: 'CUT_PIECE', label: 'Cut Pieces' },
  { value: 'STITCHED_PIECE', label: 'Stitched Pieces' },
  { value: 'FINISHED_PIECE', label: 'Finished Pieces' },
  { value: 'OTHER', label: 'Other' },
] as const;
