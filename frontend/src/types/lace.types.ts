// Lace types

// ============================================
// LACE INTERFACE
// ============================================

export interface Lace {
  id: string;
  laceCode: string;
  laceName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  width?: number | null;
  design?: string | null;
  color?: string | null;
  composition?: string | null;
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
}

// ============================================
// FORM DATA TYPES
// ============================================

export interface LaceFormData {
  laceName: string;
  supplierCode?: string;
  buyerCode?: string;
  width?: number | string;
  design?: string;
  color?: string;
  composition?: string;
  pricePerMeter?: number | string;
  supplierId?: string;
  description?: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateLaceRequest {
  laceName: string;
  supplierCode?: string;
  buyerCode?: string;
  width?: number;
  design?: string;
  color?: string;
  composition?: string;
  pricePerMeter?: number;
  supplierId?: string;
  description?: string;
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

export interface LaceResponse {
  lace: Lace;
  material?: any;
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

export interface TemplateResponse {
  columns: Array<{
    name: string;
    required: boolean;
    description: string;
  }>;
  exampleData: any[];
}
