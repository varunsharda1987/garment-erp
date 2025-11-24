// Packaging types

// ============================================
// PACKAGING INTERFACE
// ============================================

export interface Packaging {
  id: string;
  packagingCode: string;
  packagingName: string;
  supplierCode?: string | null;
  buyerCode?: string | null;
  packagingType?: string | null;
  size?: string | null;
  material?: string | null;
  thickness?: number | null;
  printDetails?: string | null;
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

export interface PackagingFormData {
  packagingName: string;
  supplierCode?: string;
  buyerCode?: string;
  packagingType?: string;
  size?: string;
  material?: string;
  thickness?: number | string;
  printDetails?: string;
  pricePerPiece?: number | string;
  pricePerHundred?: number | string;
  supplierId?: string;
  description?: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreatePackagingRequest {
  packagingName: string;
  supplierCode?: string;
  buyerCode?: string;
  packagingType?: string;
  size?: string;
  material?: string;
  thickness?: number;
  printDetails?: string;
  pricePerPiece?: number;
  pricePerHundred?: number;
  supplierId?: string;
  description?: string;
}

export interface UpdatePackagingRequest extends Partial<CreatePackagingRequest> {
  isActive?: boolean;
}

export interface PackagingListResponse {
  data: Packaging[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PackagingResponse {
  packaging: Packaging;
  material?: any;
  message?: string;
}

export interface BulkImportResult {
  success: boolean;
  row: number;
  packagingCode?: string;
  materialCode?: string;
  packagingName?: string;
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
