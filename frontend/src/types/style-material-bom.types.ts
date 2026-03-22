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

// Unit options
export const UnitOptions = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'meters', label: 'Meters' },
  { value: 'grams', label: 'Grams' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'cones', label: 'Cones' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'yards', label: 'Yards' },
];
// Cache bust: 1764071356
