// Material types

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
} as const;

export type Unit = typeof Unit[keyof typeof Unit];

export const UnitLabels: Record<Unit, string> = {
  METER: 'Meter',
  PIECE: 'Piece',
  KILOGRAM: 'Kilogram',
  SET: 'Set',
  YARD: 'Yard',
  DOZEN: 'Dozen',
};

// ============================================
// MATERIAL CATEGORY
// ============================================

export interface MaterialCategory {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count?: {
    materials: number;
  };
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

// ============================================
// MATERIAL
// ============================================

export interface Material {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  description?: string | null;
  specifications?: string | null;
  unit: Unit;
  costPrice: number;
  reorderLevel?: number | null;
  supplierId?: string | null;
  image?: string | null;
  categoryData?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Relationships
  category?: MaterialCategory;
  supplier?: {
    id: string;
    code: string;
    name: string;
    supplierCategory: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  inventoryStock?: InventoryStock[];
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
  costPrice: number | string;
  reorderLevel?: number | string;
  supplierId?: string;
  image?: string;
  categoryData?: any;
}

export interface UpdateMaterialRequest {
  code: string;
  name: string;
  categoryId: string;
  description?: string;
  specifications?: string;
  unit: Unit;
  costPrice: number | string;
  reorderLevel?: number | string;
  supplierId?: string;
  image?: string;
  categoryData?: any;
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
