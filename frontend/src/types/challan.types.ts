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
    style?: { id: string; styleCode: string; styleName: string };
  };
  purchaseOrder?: { id: string; poNumber: string; suppliers?: { id: string; name: string } };
  issuedBy?: { id: string; firstName: string; lastName: string };
  receivedBy?: { id: string; firstName: string; lastName: string };
  items: ChallanItem[];
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
