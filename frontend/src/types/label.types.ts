// Label types

// ============================================
// LABEL INTERFACE
// ============================================

export interface Label {
  id: string;
  labelCode: string;
  labelName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  labelType?: string | null;
  size?: string | null;
  content?: string | null;
  printMethod?: string | null;
  material?: string | null;
  color?: string | null;
  pricePerPiece?: number | null;
  pricePerHundred?: number | null;
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

export interface LabelFormData {
  labelName: string;
  supplierCode?: string;
  buyerCode?: string;
  labelType?: string;
  size?: string;
  content?: string;
  printMethod?: string;
  material?: string;
  color?: string;
  pricePerPiece?: number | string;
  pricePerHundred?: number | string;
  supplierId?: string;
  description?: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateLabelRequest {
  labelName: string;
  supplierCode?: string;
  buyerCode?: string;
  labelType?: string;
  size?: string;
  content?: string;
  printMethod?: string;
  material?: string;
  color?: string;
  pricePerPiece?: number;
  pricePerHundred?: number;
  supplierId?: string;
  description?: string;
}

export interface UpdateLabelRequest extends Partial<CreateLabelRequest> {
  isActive?: boolean;
}

export interface LabelListResponse {
  data: Label[];
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

export interface LabelResponse {
  label: Label;
  material?: MaterialEntry;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  labelCode?: string;
  materialCode?: string;
  labelName?: string;
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
  labelName: string;
  supplierCode?: string;
  buyerCode?: string;
  labelType?: string;
  size?: string;
  content?: string;
  printMethod?: string;
  material?: string;
  color?: string;
  pricePerPiece?: number;
  pricePerHundred?: number;
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
