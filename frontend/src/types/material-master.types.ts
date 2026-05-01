/**
 * Material Master Types (Frontend)
 * Corresponds to backend material-master.types.ts
 *
 * IMPORTANT: These types use camelCase as the serializer converts snake_case to camelCase
 */

export const MaterialType = {
  GENERIC: 'GENERIC',
  TRIMS: 'TRIMS',
  LACE: 'LACE',
  BUTTON: 'BUTTON',
  THREAD: 'THREAD',
  ZIPPER: 'ZIPPER',
  ELASTIC: 'ELASTIC',
  LABEL: 'LABEL',
  PACKAGING: 'PACKAGING',
  ACCESSORIES: 'ACCESSORIES',
  SERVICE: 'SERVICE',
  MACHINE_PART: 'MACHINE_PART',
  OTHER: 'OTHER',
  FABRIC: 'FABRIC',
  GREIGE: 'GREIGE',
  HOOK_EYE: 'HOOK_EYE',
  SNAP_BUTTON: 'SNAP_BUTTON',
  BUCKLE: 'BUCKLE',
  BELT: 'BELT',
  VELCRO: 'VELCRO',
  DRAWSTRING: 'DRAWSTRING',
  RIBBON: 'RIBBON',
  SEQUIN: 'SEQUIN',
  BEAD: 'BEAD',
  MOTIF: 'MOTIF',
  INTERLINING: 'INTERLINING',
  PADDING: 'PADDING',
  OTHER_FASTENER: 'OTHER_FASTENER',
  OTHER_TAPE: 'OTHER_TAPE',
  OTHER_DECORATIVE: 'OTHER_DECORATIVE',
  OTHER_FUNCTIONAL: 'OTHER_FUNCTIONAL',
  OTHER_MATERIAL: 'OTHER_MATERIAL',
} as const;

export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];

export interface MaterialMaster {
  id: number;
  materialType: MaterialType;
  code: string;
  name: string;
  description?: string;

  // Generic pricing
  pricePerUnit?: number;
  pricePerMeter?: number;
  pricePerPiece?: number;
  pricePerKg?: number;
  pricePerGross?: number;
  unit?: string;

  // Currency
  currencyId?: string;
  currency?: {
    id: string;
    code: string;
    symbol: string;
  };

  // Type-specific attributes stored as JSON
  specifications?: Record<string, unknown>;

  // Standard fields
  isActive: boolean;
  hsnCode?: string;
  gstRate?: number;

  // Audit fields
  createdById: string;
  createdAt: string;
  updatedAt: string;

  // Relations - suppliers
  suppliers?: MaterialSupplierMapping[];

  // Created by user relation
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface MaterialSupplierMapping {
  id: number;
  materialId: number;
  supplierId: string;

  supplierCode?: string;
  supplierName?: string;
  supplierPrice?: number;
  leadTimeDays?: number;
  moq?: number;
  moqUnit?: string;

  isPrimary: boolean;
  isActive: boolean;

  effectiveFrom?: string;
  effectiveTo?: string;
  lastPurchaseDate?: string;

  createdAt: string;
  updatedAt: string;

  // Relation to supplier
  supplier?: {
    id: string;
    name: string;
    supplierCode?: string;
  };
}

export interface CreateMaterialMasterDto {
  materialType: MaterialType;
  code?: string; // Auto-generated if not provided
  name: string;
  description?: string;

  // Generic pricing
  pricePerUnit?: number;
  pricePerMeter?: number;
  pricePerPiece?: number;
  pricePerKg?: number;
  pricePerGross?: number;
  unit?: string;

  // Currency support
  currencyId?: number;

  // Type-specific attributes
  specifications?: Record<string, unknown>;

  // Standard fields
  isActive?: boolean;
  hsnCode?: string;
  gstRate?: number;
}

export interface UpdateMaterialMasterDto {
  name?: string;
  description?: string;

  pricePerUnit?: number;
  pricePerMeter?: number;
  pricePerPiece?: number;
  pricePerKg?: number;
  pricePerGross?: number;
  unit?: string;

  currencyId?: number;

  specifications?: Record<string, unknown>;

  isActive?: boolean;
  hsnCode?: string;
  gstRate?: number;
}

export interface MaterialMasterFilterDto {
  type?: MaterialType;
  active?: boolean;
  search?: string;
  supplierId?: number;
}

export interface MaterialSupplierMappingDto {
  supplierId: string;
  supplierCode?: string;
  supplierName?: string;
  supplierPrice?: number;
  leadTimeDays?: number;
  moq?: number;
  moqUnit?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

// Type-safe specification interfaces

export interface LaceSpecifications {
  width?: number; // in mm
  design?: string;
  pattern?: string;
  elasticity?: 'high' | 'medium' | 'low' | 'none';
  composition?: string;
  laceType?: string;
}

export interface ButtonSpecifications {
  diameter?: number; // in mm
  size?: string;
  holes?: 0 | 2 | 4;
  shape?: 'round' | 'square' | 'oval' | 'custom';
  material?: string;
  buttonType?: string;
}

export interface ThreadSpecifications {
  composition?: string;
  count?: number;
  ply?: number;
  color?: string;
  shade?: string;
  threadType?: string;
}

export interface ZipperSpecifications {
  length?: number;
  teethType?: string;
  sliderType?: string;
  tapeWidth?: number;
  brand?: string;
  zipperType?: string;
}

export interface ElasticSpecifications {
  width?: number;
  thickness?: number;
  elasticity?: string;
  composition?: string;
  elasticType?: string;
}

export interface LabelSpecifications {
  size?: string;
  labelType?: string;
  printingMethod?: string;
  material?: string;
}

export interface PackagingSpecifications {
  packagingType?: string;
  size?: string;
  dimensions?: string;
  weight?: number;
  material?: string;
}

export interface MachinePartSpecifications {
  partNumber?: string;
  machineModel?: string;
  machineType?: string;
  partType?: string;
}

// Union type for all specifications
export type MaterialSpecifications =
  | LaceSpecifications
  | ButtonSpecifications
  | ThreadSpecifications
  | ZipperSpecifications
  | ElasticSpecifications
  | LabelSpecifications
  | PackagingSpecifications
  | MachinePartSpecifications
  | Record<string, unknown>;

// Helper type for material type labels
export const MaterialTypeLabels: Record<MaterialType, string> = {
  [MaterialType.GENERIC]: 'Generic',
  [MaterialType.TRIMS]: 'Trims',
  [MaterialType.LACE]: 'Lace',
  [MaterialType.BUTTON]: 'Button',
  [MaterialType.THREAD]: 'Thread',
  [MaterialType.ZIPPER]: 'Zipper',
  [MaterialType.ELASTIC]: 'Elastic',
  [MaterialType.LABEL]: 'Label',
  [MaterialType.PACKAGING]: 'Packaging',
  [MaterialType.ACCESSORIES]: 'Accessories',
  [MaterialType.SERVICE]: 'Service',
  [MaterialType.MACHINE_PART]: 'Machine Part',
  [MaterialType.OTHER]: 'Other',
  [MaterialType.FABRIC]: 'Fabric',
  [MaterialType.GREIGE]: 'Greige',
  [MaterialType.HOOK_EYE]: 'Hook & Eye',
  [MaterialType.SNAP_BUTTON]: 'Snap Button',
  [MaterialType.BUCKLE]: 'Buckle',
  [MaterialType.BELT]: 'Belt',
  [MaterialType.VELCRO]: 'Velcro',
  [MaterialType.DRAWSTRING]: 'Drawstring',
  [MaterialType.RIBBON]: 'Ribbon',
  [MaterialType.SEQUIN]: 'Sequin',
  [MaterialType.BEAD]: 'Bead',
  [MaterialType.MOTIF]: 'Motif',
  [MaterialType.INTERLINING]: 'Interlining',
  [MaterialType.PADDING]: 'Padding',
  [MaterialType.OTHER_FASTENER]: 'Other Fastener',
  [MaterialType.OTHER_TAPE]: 'Other Tape',
  [MaterialType.OTHER_DECORATIVE]: 'Other Decorative',
  [MaterialType.OTHER_FUNCTIONAL]: 'Other Functional',
  [MaterialType.OTHER_MATERIAL]: 'Other Material',
};

// Material type categories for UI grouping
export const MaterialTypeCategories = {
  'Trim Masters': [
    MaterialType.LACE,
    MaterialType.BUTTON,
    MaterialType.THREAD,
    MaterialType.ZIPPER,
    MaterialType.ELASTIC,
    MaterialType.LABEL,
  ],
  Fasteners: [
    MaterialType.HOOK_EYE,
    MaterialType.SNAP_BUTTON,
    MaterialType.BUCKLE,
    MaterialType.BELT,
    MaterialType.VELCRO,
  ],
  Decorative: [
    MaterialType.DRAWSTRING,
    MaterialType.RIBBON,
    MaterialType.SEQUIN,
    MaterialType.BEAD,
    MaterialType.MOTIF,
  ],
  Structural: [MaterialType.INTERLINING, MaterialType.PADDING],
  Fabric: [MaterialType.FABRIC, MaterialType.GREIGE],
  Other: [
    MaterialType.PACKAGING,
    MaterialType.MACHINE_PART,
    MaterialType.OTHER_FASTENER,
    MaterialType.OTHER_TAPE,
    MaterialType.OTHER_DECORATIVE,
    MaterialType.OTHER_FUNCTIONAL,
    MaterialType.OTHER_MATERIAL,
  ],
};
