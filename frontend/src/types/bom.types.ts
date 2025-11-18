// Bill of Materials (BOM) related types

export type Unit = 'METER' | 'PIECE' | 'KILOGRAM' | 'SET' | 'YARD' | 'DOZEN';

export const Unit = {
  METER: 'METER' as Unit,
  PIECE: 'PIECE' as Unit,
  KILOGRAM: 'KILOGRAM' as Unit,
  SET: 'SET' as Unit,
  YARD: 'YARD' as Unit,
  DOZEN: 'DOZEN' as Unit,
};

export interface BOMItem {
  id: string;
  bomId: string;
  materialId: string;
  quantityPerUnit: number;
  unit: Unit;
  wastagePercent: number;
  costPerUnit: number;
  notes?: string;
  material?: {
    id: string;
    code: string;
    name: string;
    unit: Unit;
    costPrice: number;
  };
}

export interface BillOfMaterial {
  id: string;
  styleId: string;
  version: number;
  isActive: boolean;
  totalCost?: number;
  createdById: string;
  approvedById?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  bomItems: BOMItem[];
  createdBy?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  approvedBy?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  style?: {
    id: string;
    styleCode: string;
    styleName: string;
    image?: string;
    imageUrl?: string;
  };
}

export interface CreateBOMItemInput {
  materialId: string;
  quantityPerUnit: number;
  unit: Unit;
  wastagePercent?: number;
  costPerUnit: number;
  notes?: string;
}

export interface CreateBOMInput {
  styleId: string;
  bomItems: CreateBOMItemInput[];
}

export interface UpdateBOMInput {
  bomItems: CreateBOMItemInput[];
  isActive?: boolean;
}

export interface MaterialRequirement {
  material: {
    id: string;
    code: string;
    name: string;
    unit: Unit;
    costPrice: number;
  };
  quantityPerUnit: number;
  unit: Unit;
  wastagePercent: number;
  costPerUnit: number;
  baseQuantity: number;
  wastageQuantity: number;
  totalQuantity: number;
  totalCost: number;
}

export interface MaterialRequirementsCalculation {
  bom: {
    id: string;
    version: number;
    style: {
      id: string;
      styleCode: string;
      styleName: string;
    };
  };
  orderQuantity: number;
  requirements: MaterialRequirement[];
  totalMaterialCost: number;
  costPerPiece: number;
}

export interface BOMListFilters {
  styleId?: string;
  isActive?: boolean;
  approved?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface BOMListResponse {
  success: boolean;
  data: BillOfMaterial[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
