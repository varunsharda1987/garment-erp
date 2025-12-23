// Style Label Configuration Types

// ============================================
// SIZE CONFIG TYPES
// ============================================

export interface StyleLabelSizeConfig {
  id: string;
  styleLabelConfigId: string;
  size: string;
  barcodeValue: string | null;
  mrp: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SizeConfigInput {
  size: string;
  barcodeValue?: string | null;
  mrp?: number | null;
}

// ============================================
// STYLE LABEL CONFIG TYPES
// ============================================

export interface StyleLabelConfig {
  id: string;
  styleId: string;
  labelId: string;
  componentName: string | null;
  extraPercentage: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  label: {
    id: string;
    labelCode: string;
    labelName: string;
    labelCategory: 'SEWN_IN' | 'HANGTAG' | 'PRICE_TAG';
    labelType: string | null;
    fabricContent: string | null;
    washcareInstructions: string | null;
    material: string | null;
    color: string | null;
    pricePerPiece: number | null;
    pricePerHundred: number | null;
    image: string | null;
    customerId: string | null;
    customer: {
      id: string;
      name: string;
    } | null;
  };
  sizeConfigs: StyleLabelSizeConfig[];
}

export interface CreateStyleLabelInput {
  labelId: string;
  componentName?: string | null;
  extraPercentage?: number;
  notes?: string | null;
  sizeConfigs?: SizeConfigInput[];
}

export interface UpdateStyleLabelInput {
  componentName?: string | null;
  extraPercentage?: number;
  notes?: string | null;
  sizeConfigs?: SizeConfigInput[];
  isActive?: boolean;
}

// ============================================
// ORDER LABEL OVERRIDE TYPES
// ============================================

export interface OrderLabelSizeOverride {
  id: string;
  orderLabelOverrideId: string;
  size: string;
  barcodeValue: string | null;
  mrp: number | null;
  createdAt: string;
}

export interface OrderLabelOverride {
  id: string;
  orderItemId: string;
  styleLabelConfigId: string;
  extraPercentage: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  styleLabelConfig: {
    id: string;
    label: {
      id: string;
      labelCode: string;
      labelName: string;
      labelCategory: string;
    };
  };
  sizeOverrides: OrderLabelSizeOverride[];
}

export interface CreateOrderLabelOverrideInput {
  styleLabelConfigId: string;
  extraPercentage?: number | null;
  notes?: string | null;
  sizeOverrides?: SizeConfigInput[];
}

// ============================================
// LABEL REQUIREMENT TYPES
// ============================================

export interface SizeRequirement {
  size: string;
  baseQuantity: number;
  extraQuantity: number;
  totalQuantity: number;
  barcodeValue: string | null;
  mrp: number | null;
}

export interface LabelRequirement {
  labelId: string;
  labelCode: string;
  labelName: string;
  labelCategory: string;
  labelType: string | null;
  componentName: string | null;
  extraPercentage: number;
  sizeRequirements: SizeRequirement[];
  totalBaseQuantity: number;
  totalWithExtra: number;
  pricePerPiece: number | null;
  pricePerHundred: number | null;
  estimatedCost: number | null;
}

export interface OrderItemLabelRequirements {
  orderItemId: string;
  styleId: string;
  styleCode: string;
  styleName: string;
  breakup: Record<string, number>;
  labelRequirements: LabelRequirement[];
  summary: {
    totalLabels: number;
    totalEstimatedCost: number;
  };
}

export interface OrderLabelSummary {
  labelId: string;
  labelCode: string;
  labelName: string;
  labelCategory: string;
  labelType: string | null;
  totalQuantity: number;
  sizeBreakdown: Record<string, number>;
  pricePerPiece: number | null;
  pricePerHundred: number | null;
  estimatedCost: number | null;
}

export interface OrderTotalLabelRequirements {
  orderId: string;
  orderNumber: string;
  orderItemCount: number;
  labelSummary: OrderLabelSummary[];
  grandTotal: {
    totalLabelTypes: number;
    totalLabelPieces: number;
    totalEstimatedCost: number;
  };
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface StyleLabelListResponse {
  data: StyleLabelConfig[];
}

export interface StyleLabelResponse {
  data: StyleLabelConfig;
  message?: string;
}

export interface OrderLabelOverrideListResponse {
  data: OrderLabelOverride[];
}

export interface OrderItemLabelRequirementsResponse {
  data: OrderItemLabelRequirements;
}

export interface OrderTotalLabelRequirementsResponse {
  data: OrderTotalLabelRequirements;
}
