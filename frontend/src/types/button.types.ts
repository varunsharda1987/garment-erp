// Button types

// ============================================
// BUTTON INTERFACE
// ============================================

export interface Button {
  id: string;
  buttonCode: string;
  buttonName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  size?: string | null;
  holes?: number | null;
  color?: string | null;
  material?: string | null;
  shape?: string | null;
  pricePerPiece?: number | null;
  pricePerGross?: number | null;
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

export interface ButtonFormData {
  buttonName: string;
  supplierCode?: string;
  buyerCode?: string;
  size?: string;
  holes?: number | string;
  color?: string;
  material?: string;
  shape?: string;
  pricePerPiece?: number | string;
  pricePerGross?: number | string;
  supplierId?: string;
  description?: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateButtonRequest {
  buttonName: string;
  supplierCode?: string;
  buyerCode?: string;
  size?: string;
  holes?: number;
  color?: string;
  material?: string;
  shape?: string;
  pricePerPiece?: number;
  pricePerGross?: number;
  supplierId?: string;
  description?: string;
}

export interface UpdateButtonRequest extends Partial<CreateButtonRequest> {
  isActive?: boolean;
}

export interface ButtonListResponse {
  data: Button[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ButtonResponse {
  button: Button;
  material?: any;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  buttonCode?: string;
  materialCode?: string;
  buttonName?: string;
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
