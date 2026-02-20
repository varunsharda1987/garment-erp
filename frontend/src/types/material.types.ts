// Material types

// ============================================
// MATERIAL TYPE ENUM
// ============================================

export const MaterialType = {
  GENERIC: 'GENERIC',
  GREIGE_FABRIC: 'GREIGE_FABRIC',
  FINISHED_FABRIC: 'FINISHED_FABRIC',
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

export type MaterialType = typeof MaterialType[keyof typeof MaterialType];

export const MaterialTypeLabels: Record<MaterialType, string> = {
  GENERIC: 'Generic',
  GREIGE_FABRIC: 'Greige Fabric',
  FINISHED_FABRIC: 'Finished Fabric',
  TRIMS: 'Trims',
  LACE: 'Lace',
  BUTTON: 'Button',
  THREAD: 'Thread',
  ZIPPER: 'Zipper',
  ELASTIC: 'Elastic',
  LABEL: 'Label',
  PACKAGING: 'Packaging',
  ACCESSORIES: 'Accessories',
  SERVICE: 'Service',
  MACHINE_PART: 'Machine Part',
  OTHER: 'Other',
  FABRIC: 'Fabric',
  GREIGE: 'Greige',
  HOOK_EYE: 'Hook & Eye',
  SNAP_BUTTON: 'Snap Button',
  BUCKLE: 'Buckle',
  BELT: 'Belt',
  VELCRO: 'Velcro',
  DRAWSTRING: 'Drawstring',
  RIBBON: 'Ribbon',
  SEQUIN: 'Sequin',
  BEAD: 'Bead',
  MOTIF: 'Motif',
  INTERLINING: 'Interlining',
  PADDING: 'Padding',
  OTHER_FASTENER: 'Other Fastener',
  OTHER_TAPE: 'Other Tape',
  OTHER_DECORATIVE: 'Other Decorative',
  OTHER_FUNCTIONAL: 'Other Functional',
  OTHER_MATERIAL: 'Other Material',
};

// ============================================
// UNIT ENUM
// ============================================

export const Unit = {
  METER: 'METER',
  PIECE: 'PIECE',
  KILOGRAM: 'KILOGRAM',
  SET: 'SET',
  YARD: 'YARD',
  DOZEN: 'DOZEN',
  GROSS: 'GROSS',
  TUBE: 'TUBE',
  CONE: 'CONE',
} as const;

export type Unit = typeof Unit[keyof typeof Unit];

export const UnitLabels: Record<Unit, string> = {
  METER: 'Meter',
  PIECE: 'Piece',
  KILOGRAM: 'Kilogram',
  SET: 'Set',
  YARD: 'Yard',
  DOZEN: 'Dozen',
  GROSS: 'Gross',
  TUBE: 'Tube',
  CONE: 'Cone',
};

// ============================================
// MATERIAL CATEGORY
// ============================================

export interface MaterialCategory {
  id: string;
  name: string;
  description?: string | null;
  parentCategoryId?: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  parent?: MaterialCategory | null;
  children?: MaterialCategory[];
  _count?: {
    materials: number;
  };
}

export interface CategoryHierarchy extends MaterialCategory {
  children: MaterialCategory[];
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

// ============================================
// MATERIAL
// ============================================

export interface SupplierRelationship {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes?: string;
}

// Category-specific data stored as JSON
// Keys are category field names, values are their corresponding values
export type CategoryData = Record<string, string | number | boolean | null>;

export interface Material {
  id: string;
  code: string;
  name: string;
  materialType: MaterialType;
  categoryId: string;
  description?: string | null;
  specifications?: string | null;
  unit: Unit;
  reorderLevel?: number | null;
  image?: string | null;
  categoryData?: CategoryData;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Relationships
  category?: MaterialCategory;
  suppliers?: Array<{
    supplier: {
      id: string;
      code: string;
      name: string;
      supplierCategories: string[];
      contactPerson?: string | null;
      phone?: string | null;
      email?: string | null;
    };
    isPreferred: boolean;
    isActive: boolean;
    notes?: string | null;
  }>;
  inventoryStock?: InventoryStock[];
  // Customer info (from linked master tables like label_master, lace_master, etc.)
  customer?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface InventoryStock {
  id: string;
  materialId: string;
  locationId: string;
  quantity: number;
  unit: Unit;
  lastUpdated: string;
  location?: {
    id: string;
    locationCode: string;
    locationName: string;
    locationType: string;
  };
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateMaterialRequest {
  code: string;
  name: string;
  categoryId: string;
  description?: string;
  specifications?: string;
  unit: Unit;
  reorderLevel?: number | string;
  suppliers?: SupplierRelationship[];
  image?: string;
  categoryData?: CategoryData;
}

export interface UpdateMaterialRequest {
  code: string;
  name: string;
  categoryId: string;
  description?: string;
  specifications?: string;
  unit: Unit;
  reorderLevel?: number | string;
  suppliers?: SupplierRelationship[];
  image?: string;
  categoryData?: CategoryData;
}

export interface MaterialListResponse {
  data: Material[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MaterialResponse {
  data: Material;
  message?: string;
}

export interface CategoryListResponse {
  data: MaterialCategory[];
}
