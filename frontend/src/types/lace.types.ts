// Lace types

// ============================================
// LACE INTERFACE
// ============================================

export interface StyleAssociation {
  styleId: string;
  styleCode: string;
  styleName?: string;
  isPrimary: boolean;
}

export interface Lace {
  id: string;
  laceCode: string;
  laceName: string;
  supplierCode?: string | null;
  buyerCode?: string | null; // DEPRECATED: Use styleCodes instead
  width?: number | null;
  design?: string | null;
  color?: string | null;
  composition?: string | null;
  laceType?: string | null;
  pricePerMeter?: number | null;
  image?: string | null;
  supplierId?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Relationships (from API response)
  materialCode?: string;
  materialId?: string;
  supplierName?: string;
  supplierCodeRef?: string;

  // Style associations (many-to-many)
  styleCodes?: string[];
  styleAssociations?: StyleAssociation[];
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface LaceFormData {
  laceName: string;
  supplierCode?: string;
  buyerCode?: string; // DEPRECATED: Use styleCodes instead
  width?: number | string;
  design?: string;
  color?: string;
  composition?: string;
  laceType?: string;
  pricePerMeter?: number | string;
  supplierId?: string;
  description?: string;
  styleCodes?: string[]; // Style code associations
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateLaceRequest {
  laceName: string;
  supplierCode?: string;
  buyerCode?: string; // DEPRECATED
  width?: number;
  design?: string;
  color?: string;
  composition?: string;
  laceType?: string;
  pricePerMeter?: number;
  supplierId?: string;
  description?: string;
  styleCodes?: string[]; // Style code associations
}

export interface UpdateLaceRequest extends Partial<CreateLaceRequest> {
  isActive?: boolean;
}

export interface LaceListResponse {
  data: Lace[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MaterialEntry {
  id: string;
  code: string;
  name: string;
  materialType: string;
  unit: string;
  isActive: boolean;
}

export interface LaceResponse {
  lace: Lace;
  material?: MaterialEntry;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  laceCode?: string;
  materialCode?: string;
  laceName?: string;
  stockCreated?: boolean;
  error?: string;
}

export interface BulkImportResponse {
  results: BulkImportResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
  message: string;
}

export interface BulkImportRow {
  laceName: string;
  supplierCode?: string;
  buyerCode?: string;
  width?: number;
  design?: string;
  color?: string;
  composition?: string;
  laceType?: string;
  pricePerMeter?: number;
  stockQuantity?: number;
  locationCode?: string;
}

export interface TemplateColumn {
  name: string;
  required: boolean;
  description: string;
}

export interface TemplateResponse {
  columns: TemplateColumn[];
  exampleData: BulkImportRow[];
}
