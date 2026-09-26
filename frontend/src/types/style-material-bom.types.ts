// Style Material BOM Types - Phase 2
export type MaterialType = 'LACE' | 'BUTTON' | 'THREAD' | 'ZIPPER' | 'ELASTIC' | 'LABEL' | 'PACKAGING';

export type MaterialUsageCategory = 'GARMENT_TRIM' | 'VALUE_ADDITION' | 'PACKAGING';

export interface MaterialSpecifications {
  // Lace
  width?: string;
  design?: string;
  color?: string;
  composition?: string;

  // Button
  size?: string;
  holes?: number;
  material?: string;
  shape?: string;

  // Thread
  threadCount?: string;
  colorCode?: string;
  threadType?: string;
  coneSize?: string;

  // Zipper
  length?: string;
  teethType?: string;
  brand?: string;
  sliderType?: string;
  tapeWidth?: string;

  // Elastic
  stretchPercent?: string;
  elasticType?: string;

  // Label
  labelType?: string;
  content?: string;
  printMethod?: string;

  // Packaging
  packagingType?: string;
  thickness?: string;
  printDetails?: string;
}

export interface Material {
  masterRecordId: string;
  materialId?: string;
  materialCode: string;
  materialName: string;
  materialType: MaterialType;
  specifications: MaterialSpecifications;
  pricePerUnit?: string;
  pricePerGross?: string;
  pricePerHundred?: string;
  unit: string;
  supplierName?: string;
  image?: string;
  isActive?: boolean;
}

export interface MaterialSearchResponse {
  materials: Material[];
  count: number;
}

export interface MaterialByCodeResponse {
  material: Material;
}

export interface StyleBOMEntry {
  id: string;
  materialId?: string | null;
  /** Set on a LABEL line — the PO form lists a style's labels as their own section */
  labelId?: string | null;
  extraPercentage?: string | null;
  materialCode: string;
  materialName: string;
  materialType: MaterialType;
  componentName?: string;
  quantityPerGarment: string;
  unit: string;
  unitPrice: string;
  totalCost: string;
  notes?: string;
}

/** One size of a label in a style's label set (GET /styles/:styleId/label-set) */
export interface LabelSetSize {
  size: string;
  sizeVariantId: string;
  /** The size's materials row; null if it was never created */
  materialId: string | null;
  /** Garments of this size on the linked order (null without an order) */
  orderGarments: number | null;
}

export interface LabelSetLabel {
  bomLineId: string;
  labelId: string;
  code: string;
  name: string;
  type: string | null;
  category: string | null;
  quantityPerGarment: number;
  extraPercent: number;
  /** The label's base materials row — what an unsized label is ordered as */
  baseMaterialId: string | null;
  /** Sizes in size order; empty for an unsized label */
  sizes: LabelSetSize[];
  /** Order sizes this sized label has no size for */
  orderSizesMissing: string[];
  supplierLinks: Array<{ supplierId: string; supplierName: string; isPreferred: boolean }>;
  /** Open requirements for this label on the linked order + style */
  openRequirementCount: number;
}

/** A style's labels with their sizes — optionally for one order (GET /styles/:styleId/label-set?orderId=) */
export interface StyleLabelSet {
  styleId: string;
  styleCode: string;
  styleName: string | null;
  source: 'ORDER_BOM' | 'STYLE_BOM';
  orderBom: { id: string; version: number; status: string } | null;
  order: {
    id: string;
    orderNumber: string;
    hasStyle: boolean;
    hasSizeBreakup: boolean;
    totalGarments: number;
    sizes: Array<{ size: string; garments: number }>;
  } | null;
  labels: LabelSetLabel[];
}

export interface StyleBOMResponse {
  styleCode: string;
  styleName: string;
  materialBOM: {
    garmentTrims: StyleBOMEntry[];
    valueAdditions: StyleBOMEntry[];
    packaging: StyleBOMEntry[];
  };
  costSummary: {
    garmentTrimsCost: string;
    valueAdditionsCost: string;
    packagingCost: string;
    totalMaterialCost: string;
  };
}

export interface AddMaterialToBOMRequest {
  materialCode: string;
  usageCategory: MaterialUsageCategory;
  componentName?: string;
  quantityPerGarment: number;
  unit: string;
  notes?: string;
}

export interface AddMaterialToBOMResponse {
  message: string;
  bomEntry: {
    id: string;
    materialCode: string;
    materialType: MaterialType;
    usageCategory: MaterialUsageCategory;
    componentName?: string;
    quantityPerGarment: string;
    unit: string;
    unitPrice?: string;
    totalCost?: string;
  };
}

export interface UpdateBOMItemRequest {
  componentName?: string;
  quantityPerGarment?: number;
  unit?: string;
  notes?: string;
  isActive?: boolean;
  // Style-specific rate; null clears the override back to master-price fallback
  unitPrice?: number | null;
}

export interface UpdateBOMItemResponse {
  message: string;
  bomEntry: {
    id: string;
    componentName?: string;
    quantityPerGarment: string;
    unit: string;
    unitPrice?: string;
    totalCost?: string;
    notes?: string;
    isActive: boolean;
  };
}

export interface DeleteBOMItemResponse {
  message: string;
}

// Helper type for material type display names
export const MaterialTypeLabels: Record<MaterialType, string> = {
  LACE: 'Lace',
  BUTTON: 'Button',
  THREAD: 'Thread',
  ZIPPER: 'Zipper',
  ELASTIC: 'Elastic',
  LABEL: 'Label',
  PACKAGING: 'Packaging',
};

// Helper type for usage category display names
export const UsageCategoryLabels: Record<MaterialUsageCategory, string> = {
  GARMENT_TRIM: 'Garment Trim',
  VALUE_ADDITION: 'Value Addition',
  PACKAGING: 'Packaging',
};

// Cache bust: 1764071356
