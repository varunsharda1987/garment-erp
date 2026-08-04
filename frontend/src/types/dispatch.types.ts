// ============================================
// Dispatch Module Types
// ============================================

// ============================================
// Status Enums
// ============================================

export type DeliveryStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED';

export const DeliveryStatusLabels: Record<DeliveryStatus, string> = {
  PENDING: 'Pending',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
};

export const DeliveryStatusColors: Record<DeliveryStatus, string> = {
  PENDING: 'bg-muted text-foreground',
  IN_TRANSIT: 'bg-info-muted text-info',
  DELIVERED: 'bg-success-muted text-success',
};

export type ASNStatus = 'PENDING' | 'APPLIED' | 'APPROVED' | 'REJECTED' | 'RESCHEDULE';

export const ASNStatusLabels: Record<ASNStatus, string> = {
  PENDING: 'Pending',
  APPLIED: 'Applied',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RESCHEDULE: 'Reschedule',
};

export const ASNStatusColors: Record<ASNStatus, string> = {
  PENDING: 'bg-muted text-foreground',
  APPLIED: 'bg-info-muted text-info',
  APPROVED: 'bg-success-muted text-success',
  REJECTED: 'bg-destructive/10 text-destructive',
  RESCHEDULE: 'bg-yellow-100 text-yellow-800',
};

export type DeliveryConfirmation = 'DELIVERED' | 'PARTIAL' | 'REJECTED';

export const DeliveryConfirmationLabels: Record<DeliveryConfirmation, string> = {
  DELIVERED: 'Delivered',
  PARTIAL: 'Partial',
  REJECTED: 'Rejected',
};

// ============================================
// ASN Application Types
// ============================================

export interface ASNSKU {
  id: string;
  asnId: string;
  colorId: string;
  sizeId: string;
  plannedQty: number;
  color?: {
    id: string;
    colorName: string;
    colorCode: string;
  };
  size?: {
    id: string;
    sizeName: string;
    sortOrder: number;
  };
}

export interface ASNApplication {
  id: string;
  asnNumber: string;
  orderId: string;

  plannedDispatchQty: number;
  cartonsPlanned: number;
  requestedShipDate: string;
  applicationDate: string;

  status: ASNStatus;
  appointmentDate?: string;
  appointmentTime?: string;
  buyerRefNumber?: string;
  approvedQty?: number;
  rejectionReason?: string;
  rescheduleDate?: string;

  remarks?: string;

  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  order?: {
    id: string;
    orderNumber: string;
    customer?: {
      id: string;
      name: string;
      billingName?: string;
    };
  };
  createdBy?: {
    id: string;
    name: string;
  };
  skus?: ASNSKU[];
}

// ============================================
// Delivery Note Types
// ============================================

export interface DeliveryNoteItem {
  id: string;
  deliveryNoteId: string;
  styleId: string;
  colorId: string;
  sizeId: string;
  quantity: number;
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    buyerStyleRef?: string | null;
  };
  color?: {
    id: string;
    colorName: string;
    colorCode: string;
  };
  size?: {
    id: string;
    sizeName: string;
    sortOrder: number;
  };
}

export interface DeliveryNote {
  id: string;
  deliveryNumber: string;
  orderId?: string | null; // Optional: delivery notes can be created without an order
  customerId: string;
  deliveryDate: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  status: DeliveryStatus;
  remarks?: string;
  createdById: string;
  createdAt: string;

  // Relations
  order?: {
    id: string;
    orderNumber: string;
  };
  customer?: {
    id: string;
    name: string;
    billingName?: string;
  };
  createdBy?: {
    id: string;
    name: string;
  };
  items?: DeliveryNoteItem[];

  // Extended info
  ext?: DeliveryNoteExt;
}

export interface DeliveryNoteExt {
  id: string;
  deliveryNoteId: string;
  asnId?: string;
  appointmentDate?: string;
  shipFrom?: string;
  billingAddress?: string;
  totalCartons?: number;
  totalPieces?: number;

  asn?: ASNApplication;
  cartons?: DispatchCarton[];
  documents?: DispatchDocument[];
  transport?: DispatchTransport;
  pod?: DispatchPOD;
}

// ============================================
// Dispatch Supporting Types
// ============================================

export interface DispatchCarton {
  id: string;
  deliveryNoteExtId: string;
  cartonId: string;
  carton?: {
    id: string;
    cartonNumber: string;
    totalPieces: number;
  };
}

export interface DispatchDocument {
  id: string;
  deliveryNoteExtId: string;
  documentType: string;
  documentNumber: string;
  documentDate: string;
  validUntil?: string;
  distanceKm?: number;
  transportMode?: string;
  vehicleType?: string;
  subtotal?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  grandTotal?: number;
  documentUrl?: string;
  status: string;
  createdById: string;
  createdAt: string;
}

export interface DispatchTransport {
  id: string;
  deliveryNoteExtId: string;
  transporterName: string;
  transporterGstin?: string;
  vehicleNumber: string;
  vehicleType?: string;
  driverName: string;
  driverPhone?: string;
  driverLicense?: string;
  lrNumber?: string;
  lrDate?: string;
  freightCharges?: number;
  freightPaidBy?: string;
  dispatchDate?: string;
  expectedDeliveryDate?: string;
  remarks?: string;
  createdById: string;
  createdAt: string;
}

export interface DispatchPOD {
  id: string;
  deliveryNoteExtId: string;
  deliveryDate: string;
  deliveryTime?: string;
  receivedBy: string;
  designation?: string;
  customerSignOff: boolean;
  podDocumentUrl?: string;
  deliveryStatus: DeliveryConfirmation;
  shortageQty?: number;
  rejectionReason?: string;
  customerGrnNumber?: string;
  customerGrnDate?: string;
  remarks?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Create/Update Request Types
// ============================================

export interface CreateASNRequest {
  orderId: string;
  plannedDispatchQty: number;
  cartonsPlanned: number;
  requestedShipDate: string;
  remarks?: string;
  skus: {
    colorId: string;
    sizeId: string;
    plannedQty: number;
  }[];
}

export interface ApproveASNRequest {
  appointmentDate: string;
  appointmentTime?: string;
  buyerRefNumber?: string;
  approvedQty?: number;
}

// Matches backend createDeliveryNoteSchema (backend/src/schemas/dispatch.schema.ts):
// items are REQUIRED (min 1) with styleId/colorId/sizeId all mandatory; cartonIds optional.
export interface CreateDeliveryNoteItemInput {
  styleId: string;
  colorId: string;
  sizeId: string;
  quantity: number;
}

export interface CreateDeliveryNoteRequest {
  orderId: string;
  customerId: string;
  deliveryDate?: string;
  asnId?: string;
  items: CreateDeliveryNoteItemInput[];
  cartonIds?: string[];
  remarks?: string;
}

export interface AssignTransportRequest {
  transporterName: string;
  transporterGstin?: string;
  vehicleNumber: string;
  vehicleType?: string;
  driverName: string;
  driverPhone?: string;
  driverLicense?: string;
  lrNumber?: string;
  lrDate?: string;
  freightCharges?: number;
  freightPaidBy?: string;
  expectedDeliveryDate?: string;
  remarks?: string;
}

export interface RecordPODRequest {
  deliveryDate: string;
  deliveryTime?: string;
  receivedBy: string;
  designation?: string;
  customerSignOff?: boolean;
  podDocumentUrl?: string;
  deliveryStatus: DeliveryConfirmation;
  shortageQty?: number;
  rejectionReason?: string;
  customerGrnNumber?: string;
  customerGrnDate?: string;
  remarks?: string;
}

// ============================================
// API Response Types
// ============================================

export interface DeliveryNoteListResponse {
  data: DeliveryNote[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ASNListResponse {
  data: ASNApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DispatchSummary {
  total: number;
  pending: number;
  inTransit: number;
  delivered: number;
  totalPieces: number;
  totalCartons: number;
  asnSummary: {
    pending: number;
    applied: number;
    approved: number;
    rejected: number;
  };
}

// ============================================
// Query Parameters
// ============================================

export interface DeliveryNoteQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DeliveryStatus;
  orderId?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ASNQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ASNStatus;
  orderId?: string;
  fromDate?: string;
  toDate?: string;
}
