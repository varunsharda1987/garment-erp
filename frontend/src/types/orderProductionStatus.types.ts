/**
 * Order Production Status Types
 * Types for order-centric production status dashboard
 */

import { ProductionStage } from './style.types';

// CAD Width option for order selection
export interface CadWidthOption {
  id: string;
  cutableWidth: number;
  cadMeters: number | null;
  cadWastagePercent: number;
  isSelected: boolean;
  isPreferred: boolean;
}

// Blocker types
export type OrderBlockerType =
  | 'CAD_NOT_APPROVED'
  | 'COSTING_PENDING'
  | 'MATERIALS_NOT_ORDERED'
  | 'MATERIALS_NOT_RECEIVED'
  | 'TRIMS_NOT_ORDERED'
  | 'DELIVERY_OVERDUE'
  | 'PRODUCTION_STUCK'
  | 'FIT_SAMPLE_NOT_APPROVED'
  | 'FIT_SAMPLE_PENDING_FEEDBACK'
  | 'PP_SAMPLE_NOT_APPROVED'
  | 'SIZE_SET_SAMPLE_NOT_APPROVED'
  | 'SHIPMENT_SAMPLE_NOT_APPROVED'
  | 'FABRIC_QC_FAILED'
  | 'INLINE_QC_FAILED'
  | 'FINAL_QC_FAILED';

export type BlockerSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface OrderBlockerInfo {
  type: OrderBlockerType;
  severity: BlockerSeverity;
  message: string;
  daysStuck: number | null;
}

export interface OrderActionInfo {
  label: string;
  route: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// Sample status
export interface SampleInfo {
  exists: boolean;
  status: string | null;
  daysPending: number | null;
  sampleId: string | null;
}

export interface OrderSampleStatus {
  fitSample: SampleInfo;
  ppSample: SampleInfo;
  sizeSetSample: SampleInfo;
  shipmentSample: SampleInfo;
}

// Inspection status
export interface InspectionInfo {
  completed: boolean;
  status: 'PASS' | 'FAIL' | 'PENDING' | null;
}

export interface OrderInspectionStatus {
  fabricInspection: InspectionInfo;
  inlineQC: InspectionInfo;
  finalQC: InspectionInfo;
}

// Order costing
export interface OrderCosting {
  totalCostPerPiece: number;
  sellingPricePerPiece: number | null;
  profitMargin: number | null;
  isRecalculated: boolean;
}

// Work order data
export interface OrderWorkOrderData {
  workOrderCount: number;
  totalPlannedQuantity: number;
  totalCompletedQuantity: number;
}

// Material status
export interface OrderMaterialStatus {
  fabricsOrdered: boolean;
  fabricsReceived: boolean;
  trimsOrdered: boolean;
  trimsReceived: boolean;
}

// Stage breakdown
export interface OrderStageBreakdown {
  ordersReceived: number;
  pendingCosting: number;
  pendingGreige: number;
  trimsNotOrdered: number;
  inPrinting: number;
  inDying: number;
  inEmbroidery: number;
  inSmocking: number;
  inHandwork: number;
  inCutting: number;
  inStitching: number;
  inFinishing: number;
  readyToShip: number;
  shipped: number;
  completed: number;
}

// Main order status item
export interface OrderStatusItem {
  // Order Item Core
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  orderDate: string | null;
  deliveryDate: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;

  // Customer
  customerId: string | null;
  customerName: string | null;

  // Style Reference
  styleId: string | null;
  styleCode: string;
  styleName: string;
  internalCode: string | null;
  imageUrl: string | null;
  brandName: string | null;
  brandCategoryId: string | null;
  season: string | null;

  // CAD Status (order-specific)
  selectedCadId: string | null;
  selectedCadWidth: number | null;
  cadStatus: 'PENDING' | 'SELECTED' | 'APPROVED';
  availableCadWidths: CadWidthOption[];

  // Production Tracking
  currentStage: ProductionStage;
  piecesInStage: number;
  lastUpdatedDate: string | null;
  stageBreakdown: OrderStageBreakdown;
  overallProgress: number;

  // Calculated Metrics
  daysToDelivery: number | null;
  isDelayed: boolean;
  isOnTrack: boolean;

  // Blockers & Actions
  blockers: OrderBlockerInfo[];
  suggestedActions: OrderActionInfo[];

  // Costing
  costing: OrderCosting | null;

  // Material Status
  materialStatus: OrderMaterialStatus;

  // Work Orders
  workOrders: OrderWorkOrderData;
  latestWorkOrderId: string | null;

  // Inheritance Settings
  sampleInheritance: 'STYLE' | 'ORDER';
  inspectionInheritance: 'STYLE' | 'ORDER';

  // Sample & Inspection Status
  sampleStatus: OrderSampleStatus;
  inspectionStatus: OrderInspectionStatus;
}

// Summary
export interface OrderStatusSummary {
  total: number;
  running: number;
  completed: number;
  delayed: number;
  needsAttention: number;
  totalOrderValue: number;
  totalPieces: number;
}

// Pagination
export interface OrderStatusPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// List response
export interface OrderStatusListResponse {
  success: boolean;
  data: OrderStatusItem[];
  pagination: OrderStatusPagination;
  summary: OrderStatusSummary;
}

// Query options
export interface OrderStatusQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  brand?: string;
  customer?: string;
  status?: 'all' | 'running' | 'completed' | 'delayed' | 'attention';
  stage?: ProductionStage;
  cadStatus?: 'PENDING' | 'SELECTED' | 'APPROVED';
  orderDateFrom?: string;
  orderDateTo?: string;
  deliveryDateFrom?: string;
  deliveryDateTo?: string;
  sortBy?: 'orderDate' | 'deliveryDate' | 'status' | 'progress' | 'orderValue';
  sortOrder?: 'asc' | 'desc';
  styleId?: string;
  orderId?: string;
}

// CAD selection request
export interface SelectCadRequest {
  cadId: string;
  recalculateCosting?: boolean;
}

// Inheritance update request
export interface UpdateInheritanceRequest {
  inheritStyleSamples?: boolean;
  inheritInspections?: boolean;
}

// Costing comparison
export interface CostingComparisonResponse {
  base: {
    id: string;
    totalCostPerPiece: number;
    fabricTotal: number;
    trimsTotal: number;
    cmtTotal: number;
    embroideryTotal: number;
    accessoriesTotal: number;
    sellingPricePerPiece: number | null;
    profitMargin: number | null;
  } | null;
  orderSpecific: {
    id: string;
    totalCostPerPiece: number;
    fabricTotal: number;
    trimsTotal: number;
    cmtTotal: number;
    embroideryTotal: number;
    accessoriesTotal: number;
    cadMeters: number | null;
    cadWidth: number | null;
    sellingPricePerPiece: number | null;
    profitMargin: number | null;
    recalculatedAt: string | null;
  } | null;
  difference: number | null;
  percentDifference: number | null;
}

// Recalculate costing response
export interface RecalculateCostingResponse {
  orderItemId: string;
  selectedCadId: string | null;
  cadMeters: number | null;
  cadWidth: number | null;
  fabricTotal: number;
  trimsTotal: number;
  cmtTotal: number;
  embroideryTotal: number;
  accessoriesTotal: number;
  processingTotal: number;
  overheadsTotal: number;
  totalCostPerPiece: number;
  sellingPricePerPiece: number | null;
  profitMargin: number | null;
  baseCostingId: string | null;
  isRecalculated: boolean;
}
