/**
 * Embroidery Master Types
 * Type definitions for embroidery design management
 */

/**
 * Supplier reference in embroidery
 */
export interface EmbroiderySupplier {
  id: string;
  code?: string;
  name: string;
}

/**
 * Embroidery master data
 */
export interface Embroidery {
  id: string;
  embroideryCode: string;
  designName: string;
  description?: string | null;

  // Design specifications
  designFile?: string | null;
  designImage?: string | null;
  stitchCount?: number | null;
  threadColors?: number | null;
  repeatWidth?: number | null;
  repeatHeight?: number | null;

  // Width impact
  minFabricWidth?: number | null;
  usableWidthAfter: number;

  // Costing
  costPerMeter?: number | null;

  // Supplier
  supplierId?: string | null;
  supplier?: EmbroiderySupplier | null;
  leadTimeDays?: number | null;

  // Origin tracking
  originalStyleId?: string | null;

  // Metadata
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Usage info (from API)
  usageCount?: number;
  usedInStyles?: Array<{
    styleId: string;
    styleCode: string;
    buyerStyleRef?: string | null;
    styleName: string;
    componentName: string;
  }>;
}

/**
 * Create embroidery request
 */
export interface CreateEmbroideryRequest {
  designName: string;
  description?: string | null;
  designFile?: string | null;
  designImage?: string | null;
  stitchCount?: number | null;
  threadColors?: number | null;
  repeatWidth?: number | null;
  repeatHeight?: number | null;
  minFabricWidth?: number | null;
  usableWidthAfter: number;
  costPerMeter?: number; // Optional - can be set later
  supplierId?: string | null;
  leadTimeDays?: number | null;
  originalStyleId?: string | null;
}

/**
 * Update embroidery request
 */
export interface UpdateEmbroideryRequest extends Partial<CreateEmbroideryRequest> {
  isActive?: boolean;
}

/**
 * Embroidery list response
 */
export interface EmbroideryListResponse {
  data: Embroidery[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Single embroidery response
 */
export interface EmbroideryResponse {
  data: Embroidery;
  message?: string;
}

/**
 * Embroidery search result (minimal data for picker)
 */
export interface EmbroiderySearchResult {
  id: string;
  embroideryCode: string;
  designName: string;
  designImage?: string | null;
  stitchCount?: number | null;
  threadColors?: number | null;
  usableWidthAfter?: number | null;
  costPerMeter?: number | null;
  supplierName?: string | null;
}

/**
 * Embroidery search response
 */
export interface EmbroiderySearchResponse {
  data: EmbroiderySearchResult[];
}

/**
 * Query parameters for listing embroidery
 */
export interface EmbroideryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  isActive?: boolean | 'all';
}

// ============================================
// EMBROIDERY STOCK TYPES
// ============================================

/**
 * Embroidery send-out record for tracking fabric sent for embroidery
 */
export interface EmbroiderySendOut {
  id: string;
  sourceFabricStockId: string;
  sourceFabricStock?: {
    id: string;
    fabricId: string;
    width: number;
    quantityAvailable: number;
    weightedAvgCost: number;
    fabricMaster?: {
      fabricCode: string;
      fabricName: string;
      colorName?: string;
    };
  };
  embroideryId: string;
  embroidery?: Embroidery;
  supplierId: string;
  supplier?: {
    id: string;
    code?: string;
    name: string;
  };
  quantitySent: number;
  quantityReceived?: number | null;
  quantityDamaged?: number | null;
  unit: string;
  sentWidth: number;
  receivedWidth?: number | null;
  sendDate: string;
  expectedReturnDate?: string | null;
  actualReturnDate?: string | null;
  agreedRate: number;
  actualCost?: number | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  status: 'SENT' | 'IN_PROGRESS' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'CANCELLED';
  remarks?: string | null;
  resultFabricStockId?: string | null;
  forStyleId?: string | null;
  forStyle?: {
    id: string;
    styleCode: string;
    styleName: string;
    buyerStyleRef?: string | null;
  } | null;
  forOrderId?: string | null;
  forOrder?: {
    id: string;
    orderNumber: string;
  } | null;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Send-out request for embroidery
 */
export interface EmbroiderySendOutRequest {
  sourceFabricStockId: string;
  embroideryId: string;
  supplierId: string;
  quantitySent: number;
  sentWidth: number;
  sendDate: string;
  expectedReturnDate?: string;
  agreedRate: number;
  forStyleId?: string;
  forOrderId?: string;
  remarks?: string;
}

/**
 * Receive request for embroidered fabric
 */
export interface EmbroideryReceiveRequest {
  sendOutId: string;
  quantityReceived: number;
  quantityDamaged?: number;
  receivedWidth: number;
  actualReturnDate: string;
  actualCost?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  qualityGrade?: 'A' | 'B' | 'DEFECT';
  warehouseLocation?: string;
  remarks?: string;
}

/**
 * Embroidered fabric stock item
 */
export interface EmbroideredFabricStock {
  id: string;
  fabricId: string;
  fabricMaster?: {
    fabricCode: string;
    fabricName: string;
    colorName?: string;
  };
  embroideryId: string;
  embroidery?: {
    id: string;
    embroideryCode: string;
    designName: string;
    designImage?: string | null;
    costPerMeter: number;
  };
  width: number;
  quantityAvailable: number;
  quantityReserved: number;
  unit: string;
  weightedAvgCost: number;
  qualityGrade: 'A' | 'B' | 'DEFECT';
  warehouseLocation?: string;
  rackNumber?: string;
  receivedDate: string;
  agingDays?: number;
  stockType: string;
  status: string;
  forStyleId?: string | null;
  forStyle?: {
    id: string;
    styleCode: string;
    styleName: string;
    buyerStyleRef?: string | null;
  } | null;
}

/**
 * Query parameters for send-outs
 */
export interface EmbroiderySendOutQueryParams {
  status?: string;
  embroideryId?: string;
  supplierId?: string;
  forStyleId?: string;
  forOrderId?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Embroidery stock summary
 */
export interface EmbroideryStockSummary {
  totalSendOuts: number;
  pendingSendOuts: number;
  overdueSendOuts: number;
  totalEmbroideredStock: number;
  totalEmbroideredValue: number;
  byStatus: {
    status: string;
    count: number;
    totalQuantity: number;
  }[];
  byEmbroidery: {
    embroideryId: string;
    embroideryCode: string;
    designName: string;
    sentQuantity: number;
    receivedQuantity: number;
    pendingQuantity: number;
  }[];
}
